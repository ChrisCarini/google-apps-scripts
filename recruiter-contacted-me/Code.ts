/// <reference types="google-apps-script" />
//import GmailThread = GoogleAppsScript.Gmail.GmailThread;
/**
 * Finds the emails labeled as recruiter contacted me, and adds them into the gSheet for tracking.
 *
 * Note: CHANGE THE TIMEZONE IN File -> Project Properties
 *
 */
var scriptProperties = PropertiesService.getScriptProperties();
var PERSONAL_EMAILS = scriptProperties.getProperty('PERSONAL_EMAILS').split(",");
var CONTACTED_LABEL = "Recruiter Contacted Me";
// The processed label has a `/` because it is a nested label
var PROCESSED_LABEL = CONTACTED_LABEL + "/Captured";
var SEARCH_QUERY = "label:" + CONTACTED_LABEL + " AND NOT label:" + PROCESSED_LABEL;

var GMAIL_SEARCH_PAGE_SIZE = 100;
const HEADER_ROW = ["Date", "Time", "Name", "Email", "Company", "Contact Location", "Email", "Role", "Level", "CTA",
    "Notes"];

/**
 * Gets the name and email for a given mailStr.
 *      - name = matches[1];
 *      - email = matches[2];
 *
 *  mailStr format may be either one of these:
 *      - name@domain.com
 *      - any text <name@domain.com>
 *      - "any text" <name@domain.com>
 *
 * @param mailStr
 */
function getEmailMatch(mailStr) {
    return mailStr.match(/\s*"?([^"]*)"?\s+<(.+)>/);
}

/**
 * Sort a matrix (list of lists) by the first two columns.
 * @param a The first nested list
 * @param b The second nested list
 */
function sortDualColumnDate(a, b) {
    // If the date is the same, check the time
    if (a[0] === b[0]) {
        // Compare the time column
        if (a[1] === b[1]) {
            return 0;
        } else {
            return (a[1] < b[1]) ? -1 : 1;
        }
    } else {
        return (a[0] < b[0]) ? -1 : 1;
    }
}

/**
 * Check if a given email is known to be sent from LinkedIn
 * @param email
 */
function isKnownLinkedInEmail(email) {
    return ["inmail-hit-reply@linkedin.com", "hit-reply@linkedin.com", "hit-reply-premium-inmail@linkedin.com"]
        // @ts-ignore - ignore `.includes()` as Google Apps Script engine runs it fine.
        .includes(email);
}

function getEmailThreads(searchQuery, index) {
    // Search in pages of GMAIL_SEARCH_PAGE_SIZE
    var threads = GmailApp.search(searchQuery, index, GMAIL_SEARCH_PAGE_SIZE);
    // If there are no threads, end recursion.
    if (threads.length == 0) {
        return [];
    } else {
        return threads.concat(getEmailThreads(searchQuery, index + GMAIL_SEARCH_PAGE_SIZE));
    }
}

function populateSpreadSheet(sheetName, sheetQuery) {
    // Get the active spreadsheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // Get / create the target sheet and ensure its empty
    // var sheetName = "Label: " + CONTACTED_LABEL;
    var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName, ss.getSheets().length);
    sheet.clear();
    // Get the email threads
    var threads = getEmailThreads(sheetQuery, 0);
    // Variable storing the rows to put in the sheet
    var rows = [];
    // Get all messages for the threads, and loops over all messages
    let messages = GmailApp.getMessagesForThreads(threads);
    for (var msg_idx = 0; msg_idx < messages.length; msg_idx++) {
        // Loop over all messages in this thread
        for (var thread_idx = 0; thread_idx < messages[msg_idx].length; thread_idx++) {
            var message = messages[msg_idx][thread_idx];
            var mDate = Utilities.formatDate(message.getDate(), "America/Los_Angeles", "yyyy-MM-dd'T'HH:mm").split("T");
            var mailDate = mDate[0];
            var mailTime = mDate[1];
            var mailFrom = message.getFrom();
            var fromEmailMatches = getEmailMatch(mailFrom);
            var fromName = fromEmailMatches ? fromEmailMatches[1] : "";
            var fromEmail = fromEmailMatches ? fromEmailMatches[2] : mailFrom;
            var toEmail = message.getTo();
            var toEmailMatches = getEmailMatch(toEmail);
            toEmail = toEmailMatches ? toEmailMatches[2] : toEmail;
            // @ts-ignore - ignore `.includes()` as Google Apps Script engine runs fine.
            if (PERSONAL_EMAILS.includes(fromEmail)) {
                continue;
            }
            var fromLinkedInAlias = isKnownLinkedInEmail(fromEmail);
            var contactLocation = fromLinkedInAlias ? "InMail" : "Personal Email";
            // If from email is a LI email...
            // ------------------------------
            // 1) clear the from email alias.
            fromEmail = fromLinkedInAlias ? "" : fromEmail;
            // 2) clear the to email alias.
            toEmail = fromLinkedInAlias ? "N/A" : toEmail.toLowerCase();
            // Add the data
            rows.push([mailDate, mailTime, fromName, fromEmail, "", contactLocation, toEmail, "", "", "", ""]);
        }
    }
    // Sort the data by the date + time columns
    rows.sort(sortDualColumnDate);
    // Add header row to beginning of list
    rows.unshift(HEADER_ROW);
    // Add row to show query for easier debugging
    rows.unshift(["Search Results for: " + sheetQuery, "", "", "", "", "", "", "", "", "", ""]);
    // Add data to corresponding sheet
    sheet.getRange(1, 1, rows.length, HEADER_ROW.length).setValues(rows);
}

function GetRecentRecruiterEmails() {
    // noinspection UnnecessaryLocalVariableJS
    const sheetName = CONTACTED_LABEL;
    populateSpreadSheet(sheetName, SEARCH_QUERY);
}

/**
 * Commenting this block out, as it seems that the gApps Script API for searching for stars does not work properly. :(
 */
// function GetNonGreenMarkEmails() {
//     const sheetName = CONTACTED_LABEL + " - Missing Green Check";
//     // populateSpreadSheet(sheetName,
//     //     "(has:red-bang OR has:yellow-bang OR has:purple-question OR has:blue-info OR -is:starred) AND " + SEARCH_QUERY);
//     populateSpreadSheet(sheetName, "(has:red-bang) AND " + SEARCH_QUERY);
// }

function LabelRecentRecruiterEmails() {
    // Get the label; if not created, create it.
    let processedLabel = GmailApp.getUserLabelByName(PROCESSED_LABEL);
    processedLabel = processedLabel ? processedLabel : GmailApp.createLabel(PROCESSED_LABEL);

    // Get all email threads
    const threads = getEmailThreads(SEARCH_QUERY, 0);
    for (let index = 0; index < threads.length; index++) {
        let thread = threads[index];
        processedLabel.addToThread(thread);
    }
}

//
// Adds a menu to easily call the script
//
function onOpen() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    const menu = [{
        name: "Get Recent Recruiter Emails", functionName: "GetRecentRecruiterEmails"
        // }, {
        //     name: "Get Emails Missing Green Check", functionName: "GetNonGreenMarkEmails"
    }, {
        name: "Label Recent Recruiter Emails", functionName: "LabelRecentRecruiterEmails"
    }];
    sheet.addMenu("Gmail Scripts - Recruiter Automation", menu);
}
