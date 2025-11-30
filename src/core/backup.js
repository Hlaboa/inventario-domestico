(() => {
  function exportUnifiedCsv({ scope, filename, sheetName, getSnapshot, getSelectionLabel, getSelectionStores, comparer }) {
    if (typeof XLSX === "undefined") {
      alert("La librería XLSX no está disponible.");
      return;
    }
    const snap = typeof getSnapshot === "function" ? getSnapshot() : {};
    const list =
      (snap && Array.isArray(snap.unifiedProducts) && snap.unifiedProducts.length
        ? snap.unifiedProducts
        : [
            ...((snap.products || []).map((p) => ({ ...p, scope: p.scope || "almacen" })) || []),
            ...((snap.extraProducts || []).map((p) => ({ ...p, scope: p.scope || "otros" })) || []),
          ]) || [];

    const rows = list
      .filter((p) => (scope ? p.scope === scope : true))
      .sort(typeof comparer === "function" ? comparer : () => 0)
      .map((p) => ({
        Producto: p.name || "",
        Familia: p.block || "",
        Tipo: p.type || "",
        Ubicación: p.shelf || "",
        Cantidad: p.quantity || "",
        Selección: typeof getSelectionLabel === "function" ? getSelectionLabel(p) : "",
        Tiendas: typeof getSelectionStores === "function" ? getSelectionStores(p) : "",
        Comprar: p.buy ? "Sí" : "No",
        Tengo: p.have ? "Sí" : "No",
        "F. adquisición": p.acquisitionDate || "",
        Caducidad: p.expiryText || "",
        Notas: p.notes || "",
        Scope: p.scope || "",
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Productos");
    XLSX.writeFile(wb, filename || "productos.xlsx");
  }

  function exportStoresCsv({ stores, getSnapshot, filename, sheetName } = {}) {
    if (typeof XLSX === "undefined") {
      alert("La librería XLSX no está disponible.");
      return;
    }
    const snap = typeof getSnapshot === "function" ? getSnapshot() : {};
    const list =
      (Array.isArray(stores) && stores.length ? stores : snap.suppliers) || [];
    const rows = list
      .slice()
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
      )
      .map((s) => ({
        Tienda: s.name || "",
        Tipo: s.type || "",
        Ubicación: s.location || "",
        Web: s.website || "",
        Notas: s.notes || "",
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Tiendas");
    XLSX.writeFile(wb, filename || "tiendas.xlsx");
  }

  function exportBackup({ snapshot }) {
    const snap = snapshot || {};
    const data = {
      products: snap.products || [],
      extraProducts: snap.extraProducts || [],
      unifiedProducts: snap.unifiedProducts || [],
      suppliers: snap.suppliers || [],
      producers: snap.producers || [],
      productInstances: snap.productInstances || [],
      classifications: snap.classifications || [],
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const ts = new Date();
    const yyyy = ts.getFullYear();
    const mm = String(ts.getMonth() + 1).padStart(2, "0");
    const dd = String(ts.getDate()).padStart(2, "0");
    const hh = String(ts.getHours()).padStart(2, "0");
    const mi = String(ts.getMinutes()).padStart(2, "0");
    a.href = url;
    a.download = `backup-almacen-${yyyy}${mm}${dd}-${hh}${mi}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  function importBackup({ file, onSnapshot }) {
    if (!file || typeof onSnapshot !== "function") return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const data = JSON.parse(text);
        const snapshot = {
          unifiedProducts: Array.isArray(data.unifiedProducts)
            ? data.unifiedProducts
            : [
                ...(Array.isArray(data.products) ? data.products : []).map((p) => ({
                  ...p,
                  scope: "almacen",
                })),
                ...(Array.isArray(data.extraProducts) ? data.extraProducts : []).map((p) => ({
                  ...p,
                  scope: "otros",
                })),
              ],
          suppliers: Array.isArray(data.suppliers) ? data.suppliers : [],
          producers: Array.isArray(data.producers) ? data.producers : [],
          productInstances: Array.isArray(data.productInstances) ? data.productInstances : [],
          classifications: Array.isArray(data.classifications) ? data.classifications : [],
        };
        onSnapshot(snapshot);
        alert("Copia de seguridad restaurada correctamente.");
      } catch (err) {
        console.error(err);
        alert("No se pudo leer el archivo de copia de seguridad. Asegúrate de que es un JSON válido.");
      }
    };
    reader.readAsText(file);
  }

  window.BackupUtils = {
    exportBackup,
    importBackup,
    exportUnifiedCsv,
    exportStoresCsv,
  };
})();
