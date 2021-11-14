# Automatic Gmail Actions

A Google Apps Script for helping me keep my inbox tidy.

Automatically takes action, at dynamic intervals, based upon the labels of emails.

## Usage

Below are the supported `actions` and `Time Periods` - any combination of these two will work and take the respective
action.

To see some examples of usage, see the [Examples](#examples) section below.

### `actions`

These are self-describing.

- Archive
- Delete

### `Time Periods`

There are two supported `time periods` that can be used:

1) relative `intervals`
2) absolute `dates`

#### `intervals`

The supported intervals are based off of the [Gmail Search Operators](https://support.google.com/mail/answer/7190)
for `older_than`.

- `NOW` - Special keyword to denote immediate action.
- `X days`
- `X months`
- `X years`

**Note:** The `days`, `months` and `years` need to be prefaced with a number & space, and can be:
- UPPER CASE (ie, `DAYS`, `MONTHS`, `YEARS`)
- lower case (ie, `days`, `months`, `years`)
- Camel Case (ie, `Days`, `Months`, `Years`)

#### `dates`

If you would like, you can specify a date _(and time!)_ in the label so long as it is able to be parsed by the
JavaScript `Date.parse()` method.

_**Note:** When the `action` is set to `Delete`, the corresponding label will also be deleted entirely. The label will be
left alone when the `action` is set to `Archive`._

### Examples

Below are some examples, any email with the following labels will follow the action / schedule specified below:

| **Label**                    | **Action**                                                  |
|:-----------------------------|:------------------------------------------------------------|
|`Automatic/Delete/7 Days`     | Automatically Delete these emails after 7 days              |
|`Automatic/Delete/NOW`        | Automatically Delete these emails next time the script runs |
|`Automatic/Archive/4 DAYS`    | Automatically Archive these emails after 4 days             |
|`Automatic/Archive/1 day`     | Automatically Archive these emails after 1 day              |
|`Automatic/Delete/2021-11-14` | Automatically Delete these emails after Nov 14th, 2021      |
