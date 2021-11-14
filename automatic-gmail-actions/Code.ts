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
const REPORT_TAG = "[Auto Gmail Actions]";

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
 * Checks if the provided string is parse-able by `Date.parse()`
 * @param str The input string to check
 */
function isDateParsable(str) {
    return !isNaN(Date.parse(str))
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

    // If we have a `YYYY-MM-DD` formatted string, return that.
    if (isDateParsable(timePeriod)) {
        Logger.log("String is Date parse-able: " + timePeriod);
        return timePeriod;
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
    // If the time period is not a parseable date, we assume it is a time duration (ie, it is `4d` or `1m` or similar),
    // and we can create a query filter, and return it immediately.
    if (!isDateParsable(rule.timePeriod)) {
        return {query: "(label:" + rule.labelName + " AND older_than:" + rule.timePeriod + ")", cleanupLabel: null};
    }

    // Otherwise, the time period might be a specific date
    const ruleTime = new Date(Date.parse(rule.timePeriod));
    // Add one to the date (JS will handle incrementing the month/year, if needed)
    // as we want the email action to be taken one day past the date specified.
    // That is, if we label an email `Automatic/Delete/2021-11-15` we would expect
    // that the day **after** 2021-11-15 the email would be deleted.
    ruleTime.setDate(ruleTime.getDate() + 1);

    // If the specified time has passed, we have a label to process & cleanup. Otherwise, do nothing.
    if (ruleTime.getTime() <= new Date().getTime()) {
        return {query: "(label:" + rule.labelName + ")", cleanupLabel: rule.labelName};
    } else {
        return {query: null, cleanupLabel: null};
    }
}

/**
 * Process the given rules.
 * @param rules A list of objects representing rules.
 * @param processThreadCallback The callback method that will be called on each thread that matches the provided rules.
 * @param cleanupLabelsCallback The callback method that will be used to clean up any needed labels.
 */
function processRules(rules, processThreadCallback, cleanupLabelsCallback) {
    if (rules.length == 0) {
        return;
    }
    let searchQueryPieces = [];
    let cleanupLabels = [];
    for (let i = 0; i < rules.length; i++) {
        let result = getQueryFromActionRule(rules[i]);
        if (result.query) {
            searchQueryPieces.push(result.query);
        }
        if (result.cleanupLabel) {
            cleanupLabels.push(result.cleanupLabel);
        }
    }
    // (NOT label:Automatic/Processed) AND
    // (
    //      (label:Automatic/Archive/4 Days AND older_than:4d) OR
    //      (label:Automatic/Archive/1 Month AND older_than:1m) OR
    //      (label:Automatic/Archive/2021-11-14)
    // )
    const fullSearchQuery = "(NOT label:" + PROCESSED_LABEL + ") AND (" + searchQueryPieces.join(" OR ") + ")";
    Logger.log("Performing search: [" + fullSearchQuery + "]");
    // Get the email threads
    const threads = getEmailThreads(fullSearchQuery, 0);
    Logger.log(threads.length + " thread(s) found.");
    for (let i = 0; i < threads.length; i++) {
        processThreadCallback(threads[i]);
    }
    Logger.log(`Cleanup ${cleanupLabels.length} old label(s).`);
    for (let i = 0; i < cleanupLabels.length; i++) {
        cleanupLabelsCallback(cleanupLabels[i]);
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
        // // Since we are archiving the thread, we intentionally do not want to mark the thread read.
        // // "Why?", you might ask? Well, having unread messages in the 'archived' label makes it easier
        // // to identify which messages one *has* read vs *has not* read. Thus, we keep this commented out.
        // GmailApp.markThreadRead(thread);
        GmailApp.moveThreadToArchive(thread);
        Logger.log(`Added ${processedLabel.getName()} to thread and archived.`);
        mailSummaryItems.push(`<b><i>ARCHIVED</i></b>: subject:(${message.getSubject()}) - from:(${message.getFrom()})`);
    }, function (cleanupLabel) {
        mailSummaryItems.push(`<b><i>UNTOUCHED LABEL</i></b>: ${cleanupLabel}`);
    });

    Logger.log(`Processing ${deleteRules.length} delete rules...`);
    processRules(deleteRules, function (thread) {
        const message = thread.getMessages()[0];
        Logger.log("TRASH thread [subject:(" + message.getSubject() + ") - from:(" + message.getFrom() + ")]");
        processedLabel.addToThread(thread);
        thread.moveToTrash();
        Logger.log(`Added ${processedLabel.getName()} to thread and deleted.`);
        if (!message.getSubject().startsWith(REPORT_TAG)) {
            mailSummaryItems.push(`<b><i>DELETED</i></b>: subject:(${message.getSubject()}) - from:(${message.getFrom()})`);
        }
    }, function (labelToDelete) {
        GmailApp.getUserLabelByName(labelToDelete).deleteLabel();
        mailSummaryItems.push(`<b><i>DELETE LABEL</i></b>: ${labelToDelete}`);
    });

    // Send report of what we did, only if there was stuff done.
    if (mailSummaryItems.length > 0) {
        MailApp.sendEmail({
            to: PERSONAL_EMAIL,
            subject: `${REPORT_TAG} Action Report - Report for ${new Date()}`,
            htmlBody: `<h3>Automatic Gmail Actions - Report for ${new Date()}</h3>` + "<ul><li>" + `${mailSummaryItems.join(
                "</li><li>")}` + "</li></ul>",
        });
    }
}
