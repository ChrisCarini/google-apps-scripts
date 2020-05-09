// Compiled using ts2gas 3.6.1 (TypeScript 3.8.3)
/// <reference types="google-apps-script" />
//import GmailThread = GoogleAppsScript.Gmail.GmailThread;
/**
 * Finds and takes action upon emails with a labels matching certain pattern.
 *
 * Allows the use of Gmail filters to automatically take action (archive / delete) on emails at regular intervals.
 *
 */
const scriptProperties = PropertiesService.getScriptProperties();
const PERSONAL_EMAIL = scriptProperties.getProperty('PERSONAL_EMAIL');

const MAIN_LABEL = "Automatic";
const DELETE_NESTED_LABEL = "Delete";
const ARCHIVE_NESTED_LABEL = "Archive";
const PROCESSED_LABEL = MAIN_LABEL + "/Processed";
const NOW = "NOW";
const GMAIL_SEARCH_PAGE_SIZE = 100;

function getEmailThreads(searchQuery, index) {
    // Search in pages of GMAIL_SEARCH_PAGE_SIZE
    const threads = GmailApp.search(searchQuery, index, GMAIL_SEARCH_PAGE_SIZE);
    // If there are no threads, end recursion.
    if (threads.length == 0) {
        return [];
    } else {
        return threads.concat(getEmailThreads(searchQuery, index + GMAIL_SEARCH_PAGE_SIZE));
    }
}

/**
 * Check if a base string starts with the search string.
 */
function startsWith(base, search) {
    return base.substring(0, search.length) === search;
}

/**
 * Check if a label is a sub-label of a given 'base' label.
 * @param searchLabel The label to search - possible sub-label.
 * @param baseLabel The base label to search from.
 */
function isLabelSubLabelOf(searchLabel: string, baseLabel: string) {
    return startsWith(searchLabel, baseLabel) && searchLabel.length > baseLabel.length;
}

/**
 * Converts a label into a Gmail time period (ie, 5d, 13w); if the label ends in `/NOW` we will return `0d`
 * @param label The label to convert
 */
function convertLabelToTimePeriod(label) {
    // 'Automatic/Archive/4 Days' -> ['Automatic','Archive','4 Days']
    const splitLabel = label.split("/");
    Logger.log("splitLabel: " + splitLabel);
    // ['Automatic','Archive','4 Days'] -> '4 Days'
    const timePeriod = splitLabel[splitLabel.length - 1];
    Logger.log("timePeriod: " + timePeriod);

    // Special case for `NOW` to take action right away.
    if (timePeriod.toLowerCase() == NOW.toLowerCase()) {
        return "0d";
    }

    // '4 Days' -> ['4','Days']
    const splitTimePeriod = timePeriod.split(" ");
    Logger.log("splitTimePeriod: " + splitTimePeriod);
    // ['4','Days'] -> '4d'
    return splitTimePeriod[0] + splitTimePeriod[1][0].toLowerCase();
}

/**
 * Gets the query from the provided rule.
 * @param rule The rule for which to get the query; expects an object with `labelName` and `timePeriod` properties.
 */
function getQueryFromActionRule(rule) {
    return "(label:" + rule.labelName + " AND older_than:" + rule.timePeriod + ")";
}

/**
 * Process the given rules.
 * @param rules A list of objects representing rules.
 * @param callback The callback method that will be called on each thread that matches the provided rules.
 */
function processRules(rules, callback) {
    if (rules.length == 0) {
        return;
    }
    let searchQueryPieces = [];
    for (let i = 0; i < rules.length; i++) {
        searchQueryPieces.push(getQueryFromActionRule(rules[i]));
    }
    // (NOT label:Automatic/Processed) AND ((label:Automatic/Archive/4 Days AND older_than:4d) OR (label:Automatic/Archive/1 Month AND older_than:1m))
    const fullSearchQuery = "(NOT label:" + PROCESSED_LABEL + ") AND (" + searchQueryPieces.join(" OR ") + ")";
    Logger.log("Performing search: [" + fullSearchQuery + "]");
    // Get the email threads
    const threads = getEmailThreads(fullSearchQuery, 0);
    Logger.log(threads.length + " threads found.");
    for (let i = 0; i < threads.length; i++) {
        callback(threads[i]);
    }
}

/**
 * Get emails that are ready for processing.
 *
 * Automatically searches for labels matching the desired pattern to allow automatic archiving and deleting of emails.
 *
 * Also allows for dynamic use of date ranges pulled from the label's name.
 */
function GetAndProcessEmails() {
    Logger.log("RUNNING!!!! Checking Emails Ready to ARCHIVE");

    const base_archive_label = MAIN_LABEL + "/" + ARCHIVE_NESTED_LABEL;
    const base_delete_label = MAIN_LABEL + "/" + DELETE_NESTED_LABEL;
    const userLabels = GmailApp.getUserLabels();
    const archiveRules = [];
    const deleteRules = [];

    Logger.log(`Getting the 'processed' label [${PROCESSED_LABEL}] or creating if it does not exist.`);
    let processedLabel = GmailApp.getUserLabelByName(PROCESSED_LABEL);
    processedLabel = processedLabel ? processedLabel : GmailApp.createLabel(PROCESSED_LABEL);

    Logger.log("Searching all user labels for archive/delete labels.");
    for (let i = 0; i < userLabels.length; i++) {
        const labelName = userLabels[i].getName().toString();
        // Logger.log("Label: " + labelName);
        if (isLabelSubLabelOf(labelName, base_archive_label)) {
            Logger.log("===== FOUND ARCHIVE LABEL: " + labelName);
            archiveRules.push({labelName: labelName, timePeriod: convertLabelToTimePeriod(labelName)});
        } else if (isLabelSubLabelOf(labelName, base_delete_label)) {
            Logger.log("===== FOUND DELETE LABEL: " + labelName);
            deleteRules.push({labelName: labelName, timePeriod: convertLabelToTimePeriod(labelName)});
        }
    }

    let mailSummaryItems = [];

    Logger.log(`Processing ${archiveRules.length} archive rules...`);
    processRules(archiveRules, function (thread) {
        const message = thread.getMessages()[0];
        Logger.log("ARCHIVE thread [subject:(" + message.getSubject() + ") - from:(" + message.getFrom() + ")]");
        processedLabel.addToThread(thread);
        GmailApp.moveThreadToArchive(thread);
        Logger.log(`Added ${processedLabel.getName()} to thread and archived.`);
        mailSummaryItems.push(`<b><i>ARCHIVED</i></b>: subject:(${message.getSubject()}) - from:(${message.getFrom()})`);
    });

    Logger.log(`Processing ${deleteRules.length} delete rules...`);
    processRules(deleteRules, function (thread) {
        const message = thread.getMessages()[0];
        Logger.log("TRASH thread [subject:(" + message.getSubject() + ") - from:(" + message.getFrom() + ")]");
        processedLabel.addToThread(thread);
        thread.moveToTrash();
        Logger.log(`Added ${processedLabel.getName()} to thread and deleted.`);
        mailSummaryItems.push(`<b><i>DELETED</i></b>: subject:(${message.getSubject()}) - from:(${message.getFrom()})`);
    });

    // Send report of what we did
    MailApp.sendEmail({
        to: PERSONAL_EMAIL,
        subject: `[Auto Gmail Actions] Action Report - Report for ${new Date()}`,
        htmlBody: `<h3>Automatic Gmail Actions - Report for ${new Date()}</h3>` + "<ul><li>" + `${mailSummaryItems.join(
            "</li><li>")}` + "</li></ul>",
    });
}
