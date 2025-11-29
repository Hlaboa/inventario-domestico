(() => {
  function render({ refs, state, helpers }) {
    const {
      productTableBody,
      filterSearchInput,
      filterShelfSelect,
      filterBlockSelect,
      filterTypeSelect,
      filterStoreSelect,
      filterStatusSelect,
      summaryInfo,
    } = refs;
    const { products, productDrafts } = state;
    if (!productTableBody) return;
    productTableBody.innerHTML = "";

    let items = products.slice();
    items.sort(helpers.compareShelfBlockTypeName);
    const stripeMap = helpers.buildFamilyStripeMap(items);

    const search = (filterSearchInput.value || "").toLowerCase();
    const filterBlock = filterBlockSelect.value || "";
    const filterType = filterTypeSelect.value || "";
    const filterShelf = filterShelfSelect.value || "";
    const filterStoreId = filterStoreSelect.value || "";
    const status = filterStatusSelect.value || "all";

    const rows = [];
    let total = 0;
    let haveCount = 0;
    let missingCount = 0;

    productDrafts.forEach((d) => {
      const tr = document.createElement("tr");
      tr.className = "product-draft-row";
      tr.dataset.draftId = d.id;

      let td = document.createElement("td");
      td.appendChild(helpers.createTableInput("name", d.name || ""));
      tr.appendChild(td);

      td = document.createElement("td");
      const famSel = helpers.createFamilySelect(d.block || "");
      famSel.dataset.field = "block";
      td.appendChild(famSel);
      tr.appendChild(td);

      td = document.createElement("td");
      const typeSel = helpers.createTypeSelect(d.block || "", d.type || "");
      typeSel.dataset.field = "type";
      helpers.linkFamilyTypeSelects(famSel, typeSel);
      td.appendChild(typeSel);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(helpers.createTableInput("shelf", d.shelf || ""));
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(helpers.createTableInput("quantity", d.quantity || ""));
      tr.appendChild(td);

      td = document.createElement("td");
      td.textContent = "—";
      tr.appendChild(td);

      td = document.createElement("td");
      td.textContent = "—";
      tr.appendChild(td);

      td = document.createElement("td");
      const haveChk = helpers.createTableInput(
        "have",
        d.have ? "on" : "",
        "checkbox"
      );
      haveChk.checked = !!d.have;
      td.appendChild(haveChk);
      tr.appendChild(td);

      td = document.createElement("td");
      const adq = helpers.createTableInput(
        "acquisitionDate",
        d.acquisitionDate || "",
        "date"
      );
      td.appendChild(adq);
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(helpers.createTableInput("expiryText", d.expiryText || ""));
      tr.appendChild(td);

      td = document.createElement("td");
      td.appendChild(helpers.createTableTextarea("notes", d.notes || ""));
      tr.appendChild(td);

      td = document.createElement("td");
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn btn-small btn-danger";
      cancelBtn.dataset.action = "cancel-draft-product";
      cancelBtn.dataset.id = d.id;
      cancelBtn.textContent = "✕";
      td.appendChild(cancelBtn);
      tr.appendChild(td);

      productTableBody.appendChild(tr);
    });

    for (const p of items) {
      if (filterBlock && (p.block || "") !== filterBlock) continue;
      if (filterType && (p.type || "") !== filterType) continue;
      if (filterShelf && (p.shelf || "") !== filterShelf) continue;

      if (filterStoreId && !helpers.productMatchesStore(p, filterStoreId)) continue;

      if (status === "have" && !p.have) continue;
      if (status === "missing" && p.have) continue;

      const searchHaystack =
        (p.name || "") +
        " " +
        (p.block || "") +
        " " +
        (p.type || "") +
        " " +
        (p.shelf || "") +
        " " +
        (p.quantity || "") +
        " " +
        (p.notes || "") +
        " " +
        helpers.getSelectionLabelForProduct(p) +
        " " +
        helpers.getSelectionStoresForProduct(p);

      if (search && !searchHaystack.toLowerCase().includes(search)) continue;

      total++;
      if (p.have) haveCount++;
      else missingCount++;

      const tr = document.createElement("tr");
      tr.dataset.id = p.id;
      const stripe = stripeMap[(p.block || "").trim() || "__none__"] || 0;
      tr.classList.add(`family-stripe-${stripe}`);

      const addCellText = (text) => {
        const td = document.createElement("td");
        td.textContent = text || "";
        tr.appendChild(td);
      };

      addCellText(p.name || "");
      addCellText(p.block || "");
      addCellText(p.type || "");
      addCellText(p.shelf || "");
      addCellText(p.quantity || "");
      const selTd = document.createElement("td");
      selTd.className = "selection-td";
      const selCell = document.createElement("div");
      selCell.className = "selection-cell";
      const selBtn = helpers.createSelectionButton(p.selectionId, p.id);
      selCell.appendChild(selBtn);
      const selText = document.createElement("div");
      selText.className = "selection-text";
      selText.textContent = helpers.getSelectionLabelForProduct(p);
      selCell.appendChild(selText);
      selTd.appendChild(selCell);
      tr.appendChild(selTd);
      addCellText(helpers.getSelectionStoresForProduct(p));

      let td = document.createElement("td");
      const haveCheck = document.createElement("input");
      haveCheck.type = "checkbox";
      haveCheck.checked = !!p.have;
      haveCheck.dataset.field = "have";
      haveCheck.dataset.id = p.id;
      td.appendChild(haveCheck);
      tr.appendChild(td);

      addCellText(p.acquisitionDate || "");
      addCellText(p.expiryText || "");
      addCellText(p.notes || "");

      td = document.createElement("td");
      const moveBtn = document.createElement("button");
      moveBtn.className = "btn btn-small btn-icon";
      moveBtn.textContent = "→";
      moveBtn.dataset.action = "move-to-extra";
      moveBtn.dataset.id = p.id;
      td.appendChild(moveBtn);

      tr.appendChild(td);
      productTableBody.appendChild(tr);
      rows.push(tr);
    }

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 12;
      td.textContent = "No hay productos que coincidan con los filtros.";
      tr.appendChild(td);
      productTableBody.appendChild(tr);
    }

    if (summaryInfo) {
      summaryInfo.textContent = `Total: ${total} · Tengo: ${haveCount} · Faltan: ${missingCount}`;
    }
  }

  function bind({ refs, state, helpers }) {
    const {
      productTableBody,
      filterSearchInput,
      filterShelfSelect,
      filterBlockSelect,
      filterTypeSelect,
      filterStoreSelect,
      filterStatusSelect,
    } = refs;

    filterSearchInput.addEventListener("input", () => render({ refs, state, helpers }));
    filterShelfSelect.addEventListener("change", () => render({ refs, state, helpers }));
    filterBlockSelect.addEventListener("change", () => render({ refs, state, helpers }));
    filterTypeSelect.addEventListener("change", () => render({ refs, state, helpers }));
    filterStoreSelect.addEventListener("change", () => render({ refs, state, helpers }));
    filterStatusSelect.addEventListener("change", () => render({ refs, state, helpers }));
    productTableBody.addEventListener("click", helpers.handleInventoryTableClick);
  }

  window.InventoryView = { render, bind, init: bind };
})();
