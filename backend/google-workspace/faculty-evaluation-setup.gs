const PIAT_EVALUATION_CATEGORIES = [
  {
    name: "Teaching Effectiveness",
    questions: [
      "Explains subject concepts clearly.",
      "Demonstrates strong knowledge of the subject.",
      "Presents lessons in an organized and understandable way.",
    ],
  },
  {
    name: "Classroom Management",
    questions: [
      "Uses class time effectively.",
      "Maintains a respectful and orderly learning environment.",
      "Encourages constructive participation.",
    ],
  },
  {
    name: "Communication",
    questions: [
      "Communicates expectations and instructions clearly.",
      "Listens to and responds respectfully to students.",
      "Demonstrates fairness and respect.",
    ],
  },
  {
    name: "Professionalism",
    questions: [
      "Arrives prepared and conducts classes professionally.",
      "Treats students consistently and without favoritism.",
      "Demonstrates responsibility and integrity.",
    ],
  },
  {
    name: "Student Engagement",
    questions: [
      "Encourages students to participate in learning activities.",
      "Connects lessons to student interests or practical examples.",
      "Creates an inclusive and supportive learning environment.",
    ],
  },
  {
    name: "Assessment and Feedback",
    questions: [
      "Uses assessments that align with course learning outcomes.",
      "Provides timely and useful feedback.",
      "Explains how students can improve their performance.",
    ],
  },
];

const PIAT_EVALUATION_RATING_HELP =
  "Required 5-point scale: 1 = Poor, 2 = Fair, 3 = Satisfactory, 4 = Very Satisfactory, 5 = Excellent.";

function piatEvaluationCatalog(propertyName) {
  const raw = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!raw) {
    throw new Error("Set the " + propertyName + " Script Property from the current PIAT academic records before running setup.");
  }
  const values = JSON.parse(raw);
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error(propertyName + " must be a non-empty JSON array of verified PIAT values.");
  }
  return [...new Set(values.map((value) => value.trim()))];
}

function piatEvaluationColumn(number) {
  let value = number;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function piatEvaluationQueryFormula() {
  const questionAverages = Array.from({ length: 18 }, (_, index) =>
    "avg(" + piatEvaluationColumn(7 + index) + ")",
  );
  const select = ["D", "E", "B", "C", "F", "count(A)"].concat(questionAverages);
  const labels = [
    "D 'Faculty Member'",
    "E 'Subject'",
    "B 'Academic Year'",
    "C 'Semester'",
    "F 'Program'",
    "count(A) 'Number of Responses'",
  ].concat(questionAverages.map((expression, index) =>
    expression + " 'Question " + (index + 1) + " Average'",
  ));
  return "=IFERROR(QUERY('Raw Responses'!A:AA,\"select " + select.join(",") +
    " where A is not null group by D,E,B,C,F label " + labels.join(", ") + "\",1),\"\")";
}

function piatEvaluationInstallSummary(spreadsheet) {
  const summary = spreadsheet.getSheetByName("Evaluation Summary") || spreadsheet.insertSheet("Evaluation Summary");
  summary.clear();
  summary.getRange("A1").setFormula(piatEvaluationQueryFormula());
  summary.getRange("Y1:AF1").setValues([[
    "Teaching Effectiveness Average",
    "Classroom Management Average",
    "Communication Average",
    "Professionalism Average",
    "Student Engagement Average",
    "Assessment and Feedback Average",
    "Overall Average",
    "Performance Interpretation",
  ]]);
  summary.getRange("A1:AF1").setFontWeight("bold");
  summary.setFrozenRows(1);
  const categoryFormulas = PIAT_EVALUATION_CATEGORIES.map((_, index) => {
    const first = piatEvaluationColumn(7 + index * 3);
    const second = piatEvaluationColumn(8 + index * 3);
    const third = piatEvaluationColumn(9 + index * 3);
    return "=ARRAYFORMULA(IF(A2:A=\"\",\"\",(" + first + "2:" + first + "+ " +
      second + "2:" + second + "+ " + third + "2:" + third + ")/3))";
  });
  summary.getRange("Y2:AD2").setFormulas([categoryFormulas]);
  summary.getRange("AE2").setFormula(
    '=ARRAYFORMULA(IF(A2:A="","",(Y2:Y+Z2:Z+AA2:AA+AB2:AB+AC2:AC+AD2:AD)/6))',
  );
  summary.getRange("AF2").setFormula(
    '=ARRAYFORMULA(IF(AE2:AE="","",IF(ROUND(AE2:AE,2)>=4.5,"Excellent",IF(ROUND(AE2:AE,2)>=3.5,"Very Satisfactory",IF(ROUND(AE2:AE,2)>=2.5,"Satisfactory",IF(ROUND(AE2:AE,2)>=1.5,"Fair","Poor"))))))',
  );
  summary.getRange("AG1:AH1").setValues([["Weighted Overall Rating Sum", "Weighted Response Count"]]);
  summary.getRange("AG2").setFormula('=ARRAYFORMULA(IF(A2:A="","",AE2:AE*F2:F))');
  summary.getRange("AH2").setFormula('=ARRAYFORMULA(IF(A2:A="","",F2:F))');
  summary.getRange("AG1:AH1").setFontWeight("bold");
  summary.getRange("G2:AE").setNumberFormat("0.00");
  summary.hideColumns(33, 2);
  summary.autoResizeColumns(1, 32);
}

function piatEvaluationInstallFacultyReports(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Faculty Reports") || spreadsheet.insertSheet("Faculty Reports");
  sheet.clear();
  sheet.getRange("A1").setFormula(
    '=IFERROR(QUERY(\'Evaluation Summary\'!A:AF,"select A,B,C,D,E,F,Y,Z,AA,AB,AC,AD,AE,AF where A is not null order by A",1),"")',
  );
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 14);
}

function piatEvaluationInstallAnalytics(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Analytics") || spreadsheet.insertSheet("Analytics");
  sheet.clear();
  sheet.getRange("A1:B1").merge().setValue("PIAT Faculty Evaluation Analytics").setFontWeight("bold");
  sheet.getRange("A3:B5").setValues([
    ["Overall faculty evaluation average", ""],
    ["Google Form responses received (not a participation rate)", ""],
    ["Individual completion tracking", "Unavailable for anonymous responses"],
  ]);
  sheet.getRange("B3").setFormula(
    '=IFERROR(SUMPRODUCT(\'Evaluation Summary\'!AE2:AE,\'Evaluation Summary\'!F2:F)/SUM(\'Evaluation Summary\'!F2:F),"")',
  );
  sheet.getRange("B4").setFormula("=IFERROR(SUM('Evaluation Summary'!F2:F),0)");
  sheet.getRange("A7:B7").setValues([["Evaluation category", "Average rating"]]).setFontWeight("bold");
  const categoryRows = PIAT_EVALUATION_CATEGORIES.map((category, index) => [
    category.name,
    "=IFERROR(SUMPRODUCT('Evaluation Summary'!" + piatEvaluationColumn(25 + index) +
      "2:" + piatEvaluationColumn(25 + index) + ",'Evaluation Summary'!F2:F)/" +
      "SUM('Evaluation Summary'!F2:F),\"\")",
  ]);
  sheet.getRange(8, 1, categoryRows.length, 2).setValues(categoryRows);
  sheet.getRange("A16").setValue("Semester-to-semester trend").setFontWeight("bold");
  sheet.getRange("A17").setFormula(
    '=IFERROR(QUERY(\'Evaluation Summary\'!A:AF,"select C,D,avg(AE) where A is not null group by C,D label avg(AE) \'Overall Average\'",1),"")',
  );
  sheet.getRange("E7").setValue("Overall averages by faculty").setFontWeight("bold");
  sheet.getRange("E8").setFormula(
    '=IFERROR(QUERY(\'Evaluation Summary\'!A:AH,"select A,sum(AG),sum(AH) where A is not null group by A label sum(AG) \'Weighted Rating Sum\',sum(AH) \'Responses\'",1),"")',
  );
  sheet.getRange("H8").setValue("Overall Average").setFontWeight("bold");
  sheet.getRange("H9").setFormula('=ARRAYFORMULA(IF(E9:E="","",F9:F/G9:G))');
  sheet.setFrozenRows(2);
  sheet.autoResizeColumns(1, 6);
  sheet.insertChart(
    sheet.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(sheet.getRange("A7:B13"))
      .setPosition(7, 4, 0, 0)
      .setOption("title", "Category comparison")
      .build(),
  );
  sheet.insertChart(
    sheet.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(sheet.getRange("A17:C60"))
      .setPosition(16, 4, 0, 0)
      .setOption("title", "Semester-to-semester performance trend")
      .build(),
  );
  sheet.insertChart(
    sheet.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(sheet.getRange("E8:E60"))
      .addRange(sheet.getRange("H8:H60"))
      .setPosition(25, 4, 0, 0)
      .setOption("title", "Overall averages by faculty")
      .build(),
  );
  sheet.getRange("A23").setValue(
    "Anonymous Forms do not provide a reliable eligible-student denominator. Response totals are not completion percentages.",
  );
}

function configurePiatFacultyEvaluationReportTabs() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty("PIAT_EVALUATION_SPREADSHEET_ID");
  if (!spreadsheetId) {
    throw new Error("Run createPiatFacultyEvaluationWorkspace first to save the PIAT spreadsheet ID.");
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let responseSheet = spreadsheet.getSheetByName("Raw Responses");
  if (!responseSheet) {
    responseSheet = spreadsheet.getSheets().find((sheet) => /^Form Responses/.test(sheet.getName()));
  }
  if (!responseSheet) {
    throw new Error(
      "Link the PIAT Form to this spreadsheet first, then rerun configurePiatFacultyEvaluationReportTabs.",
    );
  }
  if (responseSheet.getName() !== "Raw Responses") responseSheet.setName("Raw Responses");
  const setupSheet = spreadsheet.getSheetByName("Workspace Setup");
  if (setupSheet && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(setupSheet);
  piatEvaluationInstallSummary(spreadsheet);
  piatEvaluationInstallFacultyReports(spreadsheet);
  piatEvaluationInstallAnalytics(spreadsheet);
}

function createPiatFacultyEvaluationWorkspace() {
  const catalogs = {
    PIAT_ACADEMIC_YEARS: piatEvaluationCatalog("PIAT_ACADEMIC_YEARS"),
    PIAT_SEMESTERS: piatEvaluationCatalog("PIAT_SEMESTERS"),
    PIAT_FACULTY: piatEvaluationCatalog("PIAT_FACULTY"),
    PIAT_SUBJECTS: piatEvaluationCatalog("PIAT_SUBJECTS"),
    PIAT_PROGRAMS: piatEvaluationCatalog("PIAT_PROGRAMS"),
  };
  const form = FormApp.create("PIAT Faculty Evaluation", true);
  form
    .setDescription(
      "Your responses are anonymous. Do not enter your name, student number, or email. Rate every statement using the required 1 to 5 scale.",
    )
    .setCollectEmail(false)
    .setRequireLogin(false)
    .setLimitOneResponsePerUser(false);
  form.addSectionHeaderItem().setTitle("Section A: Evaluation Information");
  [
    ["Academic Year", catalogs.PIAT_ACADEMIC_YEARS],
    ["Semester", catalogs.PIAT_SEMESTERS],
    ["Faculty Member", catalogs.PIAT_FACULTY],
    ["Subject", catalogs.PIAT_SUBJECTS],
    ["Program", catalogs.PIAT_PROGRAMS],
  ].forEach(([title, values]) => {
    form.addListItem().setTitle(title).setChoiceValues(values).setRequired(true);
  });

  form.addPageBreakItem().setTitle("Section B: Faculty Evaluation");
  PIAT_EVALUATION_CATEGORIES.forEach((category) => {
    form.addSectionHeaderItem().setTitle(category.name);
    category.questions.forEach((question) => {
      form.addScaleItem()
        .setTitle(question)
        .setHelpText(PIAT_EVALUATION_RATING_HELP)
        .setBounds(1, 5)
        .setLabels("Poor", "Excellent")
        .setRequired(true);
    });
  });

  form.addPageBreakItem().setTitle("Section C: Comments and Suggestions");
  form.addParagraphTextItem()
    .setTitle("What are the faculty member's strengths?")
    .setRequired(true);
  form.addParagraphTextItem()
    .setTitle("What improvements would you recommend?")
    .setRequired(true);
  form.addParagraphTextItem()
    .setTitle("Additional comments (optional)")
    .setRequired(false);

  const spreadsheet = SpreadsheetApp.create("PIAT Faculty Evaluation Responses and Reports");
  const setupSheet = spreadsheet.getSheets()[0];
  setupSheet.setName("Workspace Setup");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
  const properties = PropertiesService.getScriptProperties();
  properties.setProperties({
    PIAT_EVALUATION_FORM_URL: form.getPublishedUrl(),
    PIAT_EVALUATION_FORM_EDIT_URL: form.getEditUrl(),
    PIAT_EVALUATION_SPREADSHEET_ID: spreadsheet.getId(),
  });
  SpreadsheetApp.flush();
  configurePiatFacultyEvaluationReportTabs();
  form.setAcceptingResponses(true);
  Logger.log(JSON.stringify({
    respondentFormUrl: form.getPublishedUrl(),
    formEditUrl: form.getEditUrl(),
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
  }, null, 2));
}
