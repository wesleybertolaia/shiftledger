# ShiftLedger

An employee time tracking demo. Built with React.

Employees enter their shifts and breaks. Managers review entries, filter by employee or date range, and see total worked time. Shift validation rejects invalid durations and overlapping entries.

The demo uses fictional records and stores changes in the browser. Employee and manager views are selectable demo roles.

![ShiftLedger manager view showing employee shifts and total work hours](docs/preview.png)

## Browse the code

- [React application](./shiftledger.jsx)
- [Browser storage and date utilities](./storage.js)

## Run the demo locally

Use Node.js 24.

```sh
npm ci
npm run build
npm start
```

Open http://localhost:4173.
