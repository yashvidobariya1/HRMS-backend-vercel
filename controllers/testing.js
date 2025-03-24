exports.downloadTimesheetReport = async (req, res) => {
    try {
        const allowedRoles = ['Superadmin', 'Administrator', 'Manager', 'Employee'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ status: 403, message: 'Access Denied' });
        }

        const userId = req.body.userId || req.user._id;
        const { jobId, startDate, endDate, format } = req.body;

        const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
        if(!user){
            return res.send({ status: 404, message: 'User not found' })
        }

        // Validate Dates
        if (!moment(startDate, "YYYY-MM-DD", true).isValid() || !moment(endDate, "YYYY-MM-DD", true).isValid()) {
            return res.status(400).json({ status: 400, message: "Invalid date format" });
        }

        // Mongoose Aggregation Pipeline
        const userData = await User.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(String(userId)), isDeleted: { $ne: true } } },
            { $unwind: "$jobDetails" },
            { $match: { "jobDetails._id": new mongoose.Types.ObjectId(String(jobId)) } },
            {
                $lookup: {
                    from: "timesheets",
                    let: { userId: "$_id", jobId: "$jobDetails._id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$userId", "$$userId"] },
                                        { $eq: ["$jobId", "$$jobId"] },
                                        { $gte: ["$createdAt", new Date(startDate)] },
                                        { $lte: ["$createdAt", new Date(endDate)] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "timesheets"
                }
            },
            {
                $lookup: {
                    from: "leaves",
                    let: { userId: "$_id", jobId: "$jobDetails._id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$userId", "$$userId"] },
                                        { $eq: ["$jobId", "$$jobId"] },
                                        { $eq: ["$status", "Approved"] },
                                        { $ne: ["$isDeleted", true] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "leaves"
                }
            },
            {
                $project: {
                    firstName: "$personalDetails.firstName",
                    lastName: "$personalDetails.lastName",
                    email: "$personalDetails.email",
                    phone: "$personalDetails.phone",
                    jobTitle: "$jobDetails.jobTitle",
                    role: "$jobDetails.role",
                    joiningDate: "$jobDetails.joiningDate",
                    timesheets: 1,
                    leaves: 1
                }
            }
        ]);

        if (!userData.length) {
            return res.status(404).json({ status: 404, message: "User or Job not found" });
        }

        // Process Timesheet and Leave Data
        let reportData = [];
        let weeklyData = new Map();

        let startMoment = moment(startDate, "YYYY-MM-DD");
        let endMoment = moment(endDate, "YYYY-MM-DD");
        let joiningDate = moment(user.joiningDate, "YYYY-MM-DD");

        if (joiningDate.isBetween(startMoment, endMoment, undefined, '[]')) {
            startMoment = joiningDate;
        }

        for (let d = startMoment.clone(); d.isSameOrBefore(endMoment, "day"); d.add(1, "day")) {
            const date = d.format("YYYY-MM-DD");
            const timesheetEntry = user.timesheets.find(ts => moment(ts.createdAt).format("YYYY-MM-DD") === date);
            const leaveEntry = user.leaves.find(leave =>
                moment(date).isBetween(leave.startDate, leave.endDate || leave.startDate, undefined, '[]')
            );

            let status = "";
            let clockinTime = "-";
            let clockoutTime = "-";
            let totalHours = 0;
            let overTime = 0;
            let leaveType = "-";

            if (timesheetEntry) {
                status = "Present";
                clockinTime = timesheetEntry.clockinTime.map(t => moment(t.clockIn, "HH:mm").format("h:mm A")).join(" || ");
                clockoutTime = timesheetEntry.clockinTime.map(t => t.clockOut ? moment(t.clockOut, "HH:mm").format("h:mm A") : "-").join(" || ");
                totalHours = convertToSeconds(timesheetEntry.totalHours);
                overTime = convertToSeconds(timesheetEntry.overTime);
            } else if (leaveEntry) {
                status = leaveEntry.selectionDuration === "First-Half" || leaveEntry.selectionDuration === "Second-Half" ? "Half Leave" : "Leave";
                leaveType = leaveEntry.leaveType;
            }

            if (moment(date).day() === 6 || moment(date).day() === 0) continue;

            const weekKey = moment(date).startOf("isoWeek").format("YYYY-MM-DD");
            if (!weeklyData.has(weekKey)) {
                weeklyData.set(weekKey, { totalHours: 0, overTime: 0 });
            }

            const weekEntry = weeklyData.get(weekKey);
            weekEntry.totalHours += totalHours;
            weekEntry.overTime += overTime;
            weeklyData.set(weekKey, weekEntry);

            reportData.push({
                date,
                clockinTime,
                clockoutTime,
                totalHours: totalHours ? formatTimeFromSeconds(totalHours) : "-",
                overTime: overTime ? formatTimeFromSeconds(overTime) : "-",
                status,
                leaveType,
                weekKey
            });
        }

        const weeklySummary = Array.from(weeklyData, ([weekKey, data]) => {
            let startDate = moment(weekKey);
            if (startDate.day() === 6 || startDate.day() === 0) return null;
            const endDate = startDate.clone().add(4, "days");

            return {
                weekRange: `${startDate.format("DD-MM-YYYY")} to ${endDate.format("DD-MM-YYYY")}`,
                totalHours: formatTimeFromSeconds(data.totalHours),
                overTime: formatTimeFromSeconds(data.overTime)
            };
        }).filter(Boolean);

        const data = {
            startDate: moment(startDate).format("DD-MM-YYYY"),
            endDate: moment(endDate).format("DD-MM-YYYY"),
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email,
            userContactNumber: user.phone,
            userJobTitle: user.jobTitle,
            userRole: user.role
        };

        const fileName = `${user?.personalDetails?.firstName}${user?.personalDetails?.lastName}_timesheet_${moment().format("YYYYMMDDHHmmssSSS") + Math.floor(Math.random() * 1000)}`

        if (format === "pdf") {
                // Render the EJS template
                const templatePath = path.join(__dirname, "../views/timesheetReportFormat.ejs")
                const htmlContent = await ejs.renderFile(templatePath, { reportData, weeklySummary, data, moment })

                // Generate PDF using Puppeteer
                const browser = await puppeteer.launch()
                const page = await browser.newPage()
                await page.setContent(htmlContent, { waitUntil: "networkidle0" })
                await page.waitForSelector("table")
                await new Promise(resolve => setTimeout(resolve, 1000))
                let pdfBuffer = await page.pdf({
                    format: "A4",
                    printBackground: true,
                    margin: {
                        top: "15mm",
                        right: "10mm",
                        bottom: "15mm",
                        left: "10mm"
                    }
                })

                await browser.close()

                pdfBuffer = Buffer.from(pdfBuffer)
                const pdfBase64 = pdfBuffer.toString("base64");
                res.send({ status: 200, message: "Timesheet report generated successfully", pdfBase64, fileName });
        } else if (format === "excel") {
                // Generate Excel file
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet("Timesheet Report");

                //  1. Add Title
                const titleRow = worksheet.addRow(["Timesheet Report"]);
                titleRow.font = { bold: true, size: 20, color: { argb: 'FFFFFF' } };
                titleRow.alignment = { horizontal: "center" };
                worksheet.mergeCells(`A${titleRow.number}:F${titleRow.number}`);

                titleRow.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "343A40" }, 
                    };
                });

                worksheet.addRow([]); // Empty row for spacing

                // 2. Add User Details
                // function addMergedRow(worksheet, text) {
                //     const row = worksheet.addRow([text]); // Add row with text
                //     row.font = { bold: true };
                //     worksheet.mergeCells(`A${row.number}:B${row.number}`);
                // }
                
                // // Adding User Details with Merged Cells (First Two Columns)
                // addMergedRow(worksheet, `Name:   ${data.userName}`, worksheet.lastRow.number);
                // addMergedRow(worksheet, `Email:   ${data.userEmail}`, worksheet.lastRow.number);
                // addMergedRow(worksheet, `Contact Number:   ${data.userContactNumber}`, worksheet.lastRow.number);
                // addMergedRow(worksheet, `Job Title:   ${data.userJobTitle}`, worksheet.lastRow.number);
                // addMergedRow(worksheet, `Role:   ${data.userRole}`, worksheet.lastRow.number);
                // addMergedRow(worksheet, `Time-Duration:   ${data.startDate} to ${data.endDate}`, worksheet.lastRow.number);

                function addMergedRow(worksheet, label1, value1, label2, value2) {
                    const row = worksheet.addRow([`${label1}: ${value1}`, "", `${label2}: ${value2}`, ""]);
                    
                    worksheet.mergeCells(`A${row.number}:B${row.number}`);
                
                    worksheet.mergeCells(`C${row.number}:D${row.number}`);
                
                    row.eachCell((cell) => {
                        cell.font = { bold: true, size: 12 };
                        cell.alignment = { horizontal: "left", vertical: "middle" };
                    });
                }
                
                addMergedRow(worksheet, "Name", data.userName, "Email", data.userEmail);
                addMergedRow(worksheet, "Contact Number", data.userContactNumber, "Job Title", data.userJobTitle);
                addMergedRow(worksheet, "Role", data.userRole, "Time-Duration", `${data.startDate} to ${data.endDate}`);

                worksheet.addRow([]); // Empty row for spacing

                // 3. Add Detailed weekly summary data
                const weeklySummaryTitleRow = worksheet.addRow(["Weekly Summary"]);
                weeklySummaryTitleRow.font = { bold: true, size: 14 };
                weeklySummaryTitleRow.alignment = { horizontal: "center" };
                worksheet.mergeCells(weeklySummaryTitleRow.number, 1, weeklySummaryTitleRow.number, 4);
                const summaryHeaders = worksheet.addRow(["Week", "Time Duration", "Total Hours", "Overtime"])
                summaryHeaders.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "343A40" },
                    };
                });
                summaryHeaders.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
                summaryHeaders.alignment = { horizontal: "center" };

                // Add weekly summary data
                weeklySummary.forEach((week, index) => {
                    const newRaw = worksheet.addRow([
                        index + 1, week.weekRange, week.totalHours, week.overTime
                    ]);
                    newRaw.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
                });

                worksheet.addRow([]); // Empty row for spacing

                // 4. Add Detailed Timesheet Data
                const tableHeader = worksheet.addRow(["Date", "Clock Timing", "Total Hours", "Overtime", "Status", "Leave Type"]);
                tableHeader.font = { bold: true, size: 12, color: { argb: "FFFFFF" } }
                tableHeader.alignment = { horizontal: "center", vertical: "middle" }
                tableHeader.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "343A40" },
                    };
                });

                // Adding daily timesheet data
                reportData.forEach((row) => {
                    let clockTiming = '';
                    
                    const clockInArray = row.clockinTime.split('||').map(time => time.trim());
                    const clockOutArray = row.clockoutTime.split('||').map(time => time.trim());
                    
                    // if (clockInArray.length === clockOutArray.length) {
                    //     clockTiming = clockInArray.map((time, index) => {
                    //         let formattedTime
                    //         if(time !== '-'){
                    //             formattedTime = `${time} || ${clockOutArray[index]}`
                    //         } else {
                    //             formattedTime = '-'
                    //         }
                    //         return formattedTime;
                    //     }).join('\n');
                    // }
                
                    // const newRow = worksheet.addRow([
                    //     moment(row.date).format('DD-MM-YYYY'),
                    //     clockTiming,
                    //     row.totalHours,
                    //     row.overTime,
                    //     row.status,
                    //     row.leaveType
                    // ]);

                    // newRow.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };

                    const numRows = clockInArray.length; //
                    const startRowNumber = worksheet.lastRow ? worksheet.lastRow.number + 1 : 1
                    clockInArray.forEach((time, index) => {
                        worksheet.addRow([
                            moment(row.date).format('DD-MM-YYYY'),
                            time !== '-' ? `${time} || ${clockOutArray[index]}` : '-',
                            row.totalHours,
                            row.overTime,
                            row.status,
                            row.leaveType
                        ]).alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
                    })
                   
                    if (numRows > 1) {
                        worksheet.mergeCells(`A${startRowNumber}:A${startRowNumber + numRows - 1}`)
                        worksheet.mergeCells(`C${startRowNumber}:C${startRowNumber + numRows - 1}`)
                        worksheet.mergeCells(`D${startRowNumber}:D${startRowNumber + numRows - 1}`)
                        worksheet.mergeCells(`E${startRowNumber}:E${startRowNumber + numRows - 1}`)
                        worksheet.mergeCells(`F${startRowNumber}:F${startRowNumber + numRows - 1}`)
                    }
                });

                worksheet.columns.forEach((column) => {
                    let maxLength = 0;
                    column.eachCell({ includeEmpty: true }, (cell) => {
                        const cellValue = cell.value ? cell.value.toString() : "";
                        maxLength = Math.max(maxLength, cellValue.length);
                    });
                    column.width = maxLength + 1; // Add some padding for better spacing
                });

                const buffer = await workbook.xlsx.writeBuffer();
                const excelbase64 = buffer.toString("base64");
                return res.send({ status: 200, message: 'Timesheet report generated successfully', excelbase64, fileName })
        } else {
            return res.status(400).json({ status: 400, message: "Invalid format" });
        }
    } catch (error) {
        console.error("Error generating report:", error);
        return res.status(500).json({ status: 500, message: "Internal server error" });
    }
};
