> Why do I have a folder named ".expo" in my project?

The `.expo` folder is created automatically by Expo when the project is started with `expo start`.

> What do the files contain?

- `devices.json` stores information about connected devices and development sessions.
- `settings.json` stores local Expo server and runtime settings.

> Should I commit the `.expo` folder?

No. The `.expo` folder is local machine-specific and should not be committed to source control.
It is typically added to `.gitignore` automatically.

> Can I delete it?

Yes. If you delete `.expo`, Expo will recreate it the next time you start the project.
