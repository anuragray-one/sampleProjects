# Org Structure Explorer

A simple static web page for uploading an Excel or CSV file and rendering an organization chart from the uploaded data.

## Files
- `index.html` – page layout and upload UI
- `styles.css` – styling for the app
- `app.js` – Excel/CSV parsing and chart rendering logic
- `sample-data.csv` – example data you can load immediately

## Run locally
Open `index.html` in a browser, or serve the folder with a static server such as:

```bash
python -m http.server 8000
```

Then visit `http://127.0.0.1:8000/`.

## Data format
The app looks for columns matching names such as:
- Name / Employee
- Manager / Reports To
- Title / Role

It will also work with a simple two-column structure if needed.
