# Google App Engine Scripts

This repo contains a few Google Apps Scripts.

1) [Automatic Gmail Actions](./automatic-gmail-actions/README.md) - A script to automatically take action on 
Gmail emails based on labels.
1) [Recruiter Contacted Me](./recruiter-contacted-me/README.md) - A script to pull information from emails 
about recruiters that contact me.

## Developing

This repo makes use of `npm` for dependencies and some automation.

Use `/start_dev.sh` for easier development.

Each subdirectory is it's own 'project' / Google Apps Script, and they make use of [`clasp`](https://github.com/google/clasp)

You will want to create a `.clasp.json` file in the respective subdirectory pointing to **your** script URL, 
and place the line containing `fileExtension` in it like below:

```shell script
{
  "scriptId": "<YOUR_SCRIPT_ID>",
  "fileExtension": "ts"
}
```

This will tell `clasp` to only pull the file in `.ts` format, not `.gs` format, 
which is desired for a better development experience.

### Dependencies

The below dependencies are included in each subdirectory's `package.json` file.

From a fresh checkout, you can install them via:
```shell script
npm install
```

1) [`google-apps-script`](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/google-apps-script) - TypeScript `*.d.ts` files for auto-completion of Google Apps Script APIs
1) [`clasp`](https://github.com/google/clasp) - A CLI that allows local development of Google Apps Script projects

**Note:** Upon `npm install`, the `clasp` CLI can be invoked via:
```shell script
./node_modules/.bin/clasp
``` 