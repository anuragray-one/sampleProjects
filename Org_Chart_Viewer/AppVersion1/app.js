const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const status = document.getElementById('status');
const chart = document.getElementById('chart');
const sampleBtn = document.getElementById('sampleBtn');

const SAMPLE_DATA = `Name,Manager,Title
Ava Chen,,CEO
Ben Ortiz,Ava Chen,Engineering Director
Carla Singh,Ben Ortiz,Frontend Lead
Derek Kim,Ben Ortiz,Backend Lead
Eli Martinez,Carla Singh,UI Engineer
Fiona Lewis,Derek Kim,Platform Engineer`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const parsed = [];

  lines.forEach((line) => {
    const row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    row.push(current.trim());
    parsed.push(row);
  });

  return parsed.filter((row) => row.some((cell) => String(cell).trim() !== ''));
}

function getRowsFromWorkbook(file) {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return rows.filter((row) => row.some((cell) => String(cell).trim() !== ''));
  });
}

function toObjects(rows) {
  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((value) => String(value || '').trim());
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = String(row[index] ?? '').trim();
    });
    return obj;
  });
}

function findMatchingCell(row, candidates) {
  const values = Object.entries(row).map(([header, value]) => ({
    header,
    normalized: normalizeHeader(header),
    value,
  }));

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeader(candidate);
    const match = values.find((item) => item.normalized === normalizedCandidate);
    if (match) {
      return match.value;
    }
  }

  return '';
}

function buildOrgChartData(rows) {
  const nodes = [];
  const nodeMap = new Map();

  rows.forEach((row) => {
    const name = findMatchingCell(row, ['name', 'employee', 'employee name', 'person']) || row[Object.keys(row)[0]] || '';

    if (!name) {
      return;
    }

    const normalizedName = name.trim().toLowerCase();
    const existing = nodeMap.get(normalizedName);
    const title = findMatchingCell(row, ['title', 'role', 'position', 'job title', 'designation']) || '';
    const managerName = findMatchingCell(row, ['manager', 'reports to', 'supervisor', 'boss', 'reporting manager']) || '';

    if (existing) {
      if (title) {
        existing.title = title;
      }
      if (managerName) {
        existing.managerName = managerName;
      }
      return;
    }

    const node = {
      id: normalizedName,
      name,
      title,
      managerName,
      children: [],
    };
    nodeMap.set(normalizedName, node);
    nodes.push(node);
  });

  nodes.forEach((node) => {
    if (!node.managerName) {
      return;
    }

    const parentKey = node.managerName.trim().toLowerCase();
    const parent = nodeMap.get(parentKey);
    if (!parent || parent.id === node.id) {
      return;
    }

    parent.children.push(node);
  });

  return nodes.filter((node) => {
    const hasParent = node.managerName && nodeMap.has(node.managerName.trim().toLowerCase());
    return !hasParent;
  });
}

function renderChart(roots) {
  chart.innerHTML = '';

  if (!roots.length) {
    chart.innerHTML = '<p class="empty-state">No organization data could be read from the file.</p>';
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'tree-root';

  roots.forEach((root) => {
    const branch = document.createElement('div');
    branch.className = 'tree-item';
    branch.appendChild(buildNodeCard(root));
    if (root.children.length) {
      const children = document.createElement('div');
      children.className = 'tree-children';
      root.children.forEach((child) => children.appendChild(buildNodeBranch(child)));
      branch.appendChild(children);
    }
    wrapper.appendChild(branch);
  });

  chart.appendChild(wrapper);
}

function buildNodeBranch(node) {
  const wrap = document.createElement('div');
  wrap.className = 'tree-item';
  wrap.appendChild(buildNodeCard(node));

  if (node.children.length) {
    const children = document.createElement('div');
    children.className = 'tree-children';
    node.children.forEach((child) => children.appendChild(buildNodeBranch(child)));
    wrap.appendChild(children);
  }

  return wrap;
}

function buildNodeCard(node) {
  const card = document.createElement('div');
  card.className = 'node-card';
  card.innerHTML = `
    <strong>${escapeHtml(node.name)}</strong>
    ${node.title ? `<span>${escapeHtml(node.title)}</span>` : ''}
  `;
  return card;
}

function handleParsedRows(rows, sourceName) {
  const parsed = toObjects(rows);
  const roots = buildOrgChartData(parsed);
  renderChart(roots);
  status.textContent = `Processed ${parsed.length} rows from ${sourceName}.`;
}

function loadFile(file) {
  if (!file) {
    return;
  }

  status.textContent = `Reading ${file.name}...`;

  if (file.name.toLowerCase().endsWith('.csv')) {
    file.text().then((text) => {
      const rows = parseCsv(text);
      handleParsedRows(rows, file.name);
    });
    return;
  }

  getRowsFromWorkbook(file).then((rows) => {
    handleParsedRows(rows, file.name);
  });
}

fileInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  loadFile(file);
});

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.style.borderColor = '#7ea2ff';
});

dropzone.addEventListener('dragleave', () => {
  dropzone.style.borderColor = '#4c70ff';
});

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.style.borderColor = '#4c70ff';
  const [file] = event.dataTransfer.files;
  loadFile(file);
});

sampleBtn.addEventListener('click', () => {
  const rows = parseCsv(SAMPLE_DATA);
  handleParsedRows(rows, 'sample-data.csv');
});
