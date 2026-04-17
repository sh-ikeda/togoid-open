// TogoID database definitions
// Converted from YAML. Each entry: { key, label, regex, prefix: [{label, uri}] }

const DATABASES = [
  {
    key: "chembl_compound",
    label: "ChEMBL compound",
    regex: /^(CHEMBL\d+)$/,
    prefix: [
      { label: "rdf", uri: "http://identifiers.org/chembl.compound/" }
    ]
  },
  {
    key: "chembl_target",
    label: "ChEMBL target",
    regex: /^(CHEMBL\d+)$/,
    prefix: [
      { label: "rdf", uri: "http://identifiers.org/chembl.target/" }
    ]
  },
  {
    key: "pdb",
    label: "PDB",
    regex: /^([0-9][A-Za-z0-9]{3})$/,
    prefix: [
      { label: "PDBj",     uri: "https://pdbj.org/mine/summary/" },
      { label: "RCSB PDB", uri: "https://www.rcsb.org/structure/" },
      { label: "PDBe",     uri: "https://www.ebi.ac.uk/pdbe/entry/pdb/" }
    ]
  }
];

// Returns array of { db, prefix } candidates for a given selected text
function getCandidates(text) {
  const trimmed = text.trim();
  const results = [];
  for (const db of DATABASES) {
    if (db.regex.test(trimmed)) {
      for (const prefix of db.prefix) {
        results.push({ db, prefix });
      }
    }
  }
  return results;
}
