(() => {
  function collectRefs() {
    return {
      // Navegación principal
      summaryInfo: document.getElementById("summaryInfo"),
      mainAlmacenButton: document.getElementById("mainAlmacenButton"),
      mainOtrosButton: document.getElementById("mainOtrosButton"),
      mainSelectionButton: document.getElementById("mainSelectionButton"),
      mainClassificationButton: document.getElementById("mainClassificationButton"),
      mainProducersButton: document.getElementById("mainProducersButton"),
      mainStoresButton: document.getElementById("mainStoresButton"),
      mainOrdersButton: document.getElementById("mainOrdersButton"),
      mainBackupButton: document.getElementById("mainBackupButton"),
      mainShoppingButton: document.getElementById("mainShoppingButton"),
      almacenSection: document.getElementById("almacenSection"),
      otrosSection: document.getElementById("otrosSection"),
      classificationSection: document.getElementById("classificationSection"),
      backupSection: document.getElementById("backupSection"),
      shoppingSection: document.getElementById("shoppingSection"),
      proveedoresSection: document.getElementById("proveedoresSection"),
      ordersSection: document.getElementById("ordersSection"),

      // Modo edición
      almacenEditModeButton: document.getElementById("almacenEditModeButton"),
      otrosEditModeButton: document.getElementById("otrosEditModeButton"),

      // Paneles
      almacenInventoryPanel: document.getElementById("almacenInventoryPanel"),
      almacenEditPanel: document.getElementById("almacenEditPanel"),
      otrosListPanel: document.getElementById("otrosListPanel"),
      otrosEditPanel: document.getElementById("otrosEditPanel"),
      extraSummaryInfo: document.getElementById("extraSummaryInfo"),
      classificationSummaryInfo: document.getElementById("classificationSummaryInfo"),
      producersSummaryInfo: document.getElementById("producersSummaryInfo"),
      storesSummaryInfo: document.getElementById("storesSummaryInfo"),
      instancesSummaryInfo: document.getElementById("instancesSummaryInfo"),
      classificationSummaryInfo: document.getElementById("classificationSummaryInfo"),
      classificationSearchInput: document.getElementById("classificationSearch"),
      classificationFamilyFilterSelect: document.getElementById("classificationFamilyFilter"),
      classificationTypeFilterSelect: document.getElementById("classificationTypeFilter"),

      // Almacén (vista)
      filterSearchInput: document.getElementById("filterSearch"),
      filterShelfSelect: document.getElementById("filterShelf"),
      filterBlockSelect: document.getElementById("filterBlock"),
      filterTypeSelect: document.getElementById("filterType"),
      filterStoreSelect: document.getElementById("filterStore"),
      filterStatusSelect: document.getElementById("filterStatus"),
      productTableBody: document.getElementById("productTableBody"),
      inventoryRowTemplate: document.getElementById("inventoryRowTemplate"),
      inventoryEditRowTemplate: document.getElementById("inventoryEditRowTemplate"),
      classificationRowTemplate: document.getElementById("classificationRowTemplate"),
      producersRowTemplate: document.getElementById("producersRowTemplate"),
      storesRowTemplate: document.getElementById("storesRowTemplate"),
      instancesRowTemplate: document.getElementById("instancesRowTemplate"),

      // Almacén (editar)
      gridTableBody: document.getElementById("gridTableBody"),
      saveGridButton: document.getElementById("saveGridButton"),
      addGridRowButton: document.getElementById("addGridRowButton"),
      editFilterSearchInput: document.getElementById("editFilterSearch"),
      editFilterFamilySelect: document.getElementById("editFilterFamily"),
      editFilterTypeSelect: document.getElementById("editFilterType"),
      editFilterShelfSelect: document.getElementById("editFilterShelf"),
      editFilterStoreSelect: document.getElementById("editFilterStore"),

      // Otros (vista)
      extraListTableBody: document.getElementById("extraListTableBody"),
      extraFilterSearchInput: document.getElementById("extraFilterSearch"),
      extraFilterFamilySelect: document.getElementById("extraFilterFamily"),
      extraFilterTypeSelect: document.getElementById("extraFilterType"),
      extraFilterStoreSelect: document.getElementById("extraFilterStore"),
      extraFilterBuySelect: document.getElementById("extraFilterBuy"),

      // Otros (editar)
      extraTableBody: document.getElementById("extraTableBody"),
      addExtraRowButton: document.getElementById("addExtraRowButton"),
      saveExtraButton: document.getElementById("saveExtraButton"),
      extraEditFilterSearchInput: document.getElementById("extraEditFilterSearch"),
      extraEditFilterFamilySelect: document.getElementById("extraEditFilterFamily"),
      extraEditFilterTypeSelect: document.getElementById("extraEditFilterType"),
      extraEditFilterStoreSelect: document.getElementById("extraEditFilterStore"),
      extraQuickRowTemplate: document.getElementById("extraQuickRowTemplate"),
      extraEditRowTemplate: document.getElementById("extraEditRowTemplate"),

      // Productores
      producersSearchInput: document.getElementById("producersSearch"),
      producersLocationFilterSelect: document.getElementById("producersLocationFilter"),
      producersTableBody: document.getElementById("producersTableBody"),
      addProducerButton: document.getElementById("addProducerButton"),
      saveProducersButton: document.getElementById("saveProducersButton"),

      // Tiendas
      storesSearchInput: document.getElementById("storesSearch"),
      storesTypeFilterSelect: document.getElementById("storesTypeFilter"),
      storesLocationFilterSelect: document.getElementById("storesLocationFilter"),
      storesTableBody: document.getElementById("storesTableBody"),
      addStoreButton: document.getElementById("addStoreButton"),
      saveStoresButton: document.getElementById("saveStoresButton"),

      // Selección de productos
      instancesSearchInput: document.getElementById("instancesSearch"),
      instancesFamilyFilterSelect: document.getElementById("instancesFamilyFilter"),
      instancesProducerFilterSelect: document.getElementById("instancesProducerFilter"),
      instancesStoreFilterSelect: document.getElementById("instancesStoreFilter"),
      instancesMissingFilterButton: document.getElementById("instancesMissingFilterButton"),
      instancesTableBody: document.getElementById("instancesTableBody"),
      addInstanceButton: document.getElementById("addInstanceButton"),
      saveInstancesButton: document.getElementById("saveInstancesButton"),
      productsDatalist: document.getElementById("productsDatalist"),
      addQuickProductButton: document.getElementById("addQuickProductButton"),
      addQuickExtraButton: document.getElementById("addQuickExtraButton"),
      classificationTableBody: document.getElementById("classificationTableBody"),
      addClassificationButton: document.getElementById("addClassificationButton"),
      saveClassificationsButton: document.getElementById("saveClassificationsButton"),

      // Tabs
      producersPanel: document.getElementById("producersPanel"),
      storesPanel: document.getElementById("storesPanel"),
      instancesPanel: document.getElementById("instancesPanel"),

      // Lista compra
      shoppingListContainer: document.getElementById("shoppingListContainer"),
      shoppingSummary: document.getElementById("shoppingSummary"),
      copyListButton: document.getElementById("copyListButton"),
      instancesTableWrapper: document.getElementById("instancesTableWrapper"),
      shoppingStoreTemplate: document.getElementById("shoppingStoreTemplate"),
      shoppingItemTemplate: document.getElementById("shoppingItemTemplate"),
      ordersStoreSelect: document.getElementById("ordersStoreSelect"),
      ordersPlannedDate: document.getElementById("ordersPlannedDate"),
      ordersNameInput: document.getElementById("ordersNameInput"),
      ordersFamilyFilterSelect: document.getElementById("ordersFamilyFilter"),
      ordersTypeFilterSelect: document.getElementById("ordersTypeFilter"),
      addOrderItemButton: document.getElementById("addOrderItemButton"),
      newOrderButton: document.getElementById("newOrderButton"),
      toggleOrdersBatchButton: document.getElementById("toggleOrdersBatchButton"),
      closeOrdersBatchButton: document.getElementById("closeOrdersBatchButton"),
      ordersBatchPanel: document.getElementById("ordersBatchPanel"),
      addOrderBatchButton: document.getElementById("addOrderBatchButton"),
      ordersBatchSelect: document.getElementById("ordersBatchSelect"),
      saveOrdersButton: document.getElementById("saveOrdersButton"),
      deleteOrderButton: document.getElementById("deleteOrderButton"),
      clearOrderButton: document.getElementById("clearOrderButton"),
      ordersTableBody: document.getElementById("ordersTableBody"),
      ordersRowTemplate: document.getElementById("ordersRowTemplate"),
      ordersSummaryInfo: document.getElementById("ordersSummaryInfo"),
      ordersProductsDatalist: document.getElementById("ordersProductsDatalist"),
      ordersSavedList: document.getElementById("ordersSavedList"),

      // Backup y Excel
      exportBackupButton: document.getElementById("exportBackupButton"),
      importBackupButton: document.getElementById("importBackupButton"),
      backupFileInput: document.getElementById("backupFileInput"),
      exportAlmacenCsvButton: document.getElementById("exportAlmacenCsvButton"),
      exportOtrosCsvButton: document.getElementById("exportOtrosCsvButton"),
      exportStoresCsvButton: document.getElementById("exportStoresCsvButton"),

      // Toggle lista compra
      toggleShoppingPanelButton: document.getElementById("toggleShoppingPanelButton"),

      // Popup selección
      selectionPopupOverlay: document.getElementById("selectionPopupOverlay"),
      selectionPopup: document.getElementById("selectionPopup"),
      selectionPopupTitle: document.getElementById("selectionPopupTitle"),
      selectionPopupList: document.getElementById("selectionPopupList"),
      selectionPopupClose: document.getElementById("selectionPopupClose"),
      selectionPopupHeader: document.querySelector(".selection-popup-header"),
      selectionPopupBody: document.querySelector(".selection-popup-body"),
      productAutocompleteDropdown: null,
    };
  }

  function initMainNav(refs, handlers = {}) {
    const {
      setMainSection,
      toggleAlmacenEditMode,
      toggleOtrosEditMode,
    } = handlers;

    const {
      mainAlmacenButton,
      mainOtrosButton,
      mainSelectionButton,
      mainClassificationButton,
      mainProducersButton,
      mainStoresButton,
      mainBackupButton,
      mainShoppingButton,
      mainOrdersButton,
      almacenEditModeButton,
      otrosEditModeButton,
    } = refs || {};

    if (mainAlmacenButton && setMainSection)
      mainAlmacenButton.addEventListener("click", () => setMainSection("almacen"));
    if (mainOtrosButton && setMainSection)
      mainOtrosButton.addEventListener("click", () => setMainSection("otros"));
    if (mainSelectionButton && setMainSection)
      mainSelectionButton.addEventListener("click", () => setMainSection("selection"));
    if (mainClassificationButton && setMainSection)
      mainClassificationButton.addEventListener("click", () => setMainSection("classification"));
    if (mainProducersButton && setMainSection)
      mainProducersButton.addEventListener("click", () => setMainSection("producers"));
    if (mainStoresButton && setMainSection)
      mainStoresButton.addEventListener("click", () => setMainSection("stores"));
    if (mainOrdersButton && setMainSection)
      mainOrdersButton.addEventListener("click", () => setMainSection("orders"));
    if (mainBackupButton && typeof window.setSidePanel === "function")
      mainBackupButton.addEventListener("click", () => window.setSidePanel("backup"));
    if (mainShoppingButton && typeof window.setSidePanel === "function")
      mainShoppingButton.addEventListener("click", () => window.setSidePanel("shopping"));

    if (almacenEditModeButton && toggleAlmacenEditMode) {
      almacenEditModeButton.addEventListener("click", toggleAlmacenEditMode);
    }
    if (otrosEditModeButton && toggleOtrosEditMode) {
      otrosEditModeButton.addEventListener("click", toggleOtrosEditMode);
    }
  }

  function initFilters(refs, handlers = {}) {
    const {
      renderInstancesTable,
      handleSaveInstances,
      handleAddQuickProduct,
      handleAddQuickExtra,
      handleShoppingListClick,
      handleCopyList,
      handleExportBackup,
      handleBackupFileChange,
      handleExportAlmacenCsv,
      handleExportOtrosCsv,
      handleExportStoresCsv,
      handleToggleShoppingPanel,
      triggerImportBackup,
      handleOrdersStoreChange,
      handleAddOrderItem,
      handleNewOrder,
      handleOrderMetaChange,
      handleAddOrderBatch,
      handleOrdersFilterChange,
      handleSaveOrders,
      handleClearOrder,
      handleDeleteOrder,
      handleOrdersTableClick,
      handleOrdersSavedClick,
      handleToggleOrdersBatchPanel,
      handleCloseOrdersBatchPanel,
    } = handlers;

    const {
      instancesSearchInput,
      instancesFamilyFilterSelect,
      instancesProducerFilterSelect,
      instancesStoreFilterSelect,
      saveInstancesButton,
      addQuickProductButton,
      addQuickExtraButton,
      shoppingListContainer,
      copyListButton,
      exportBackupButton,
      importBackupButton,
      backupFileInput,
      exportAlmacenCsvButton,
      exportOtrosCsvButton,
      exportStoresCsvButton,
      ordersStoreSelect,
      ordersPlannedDate,
      ordersNameInput,
      ordersFamilyFilterSelect,
      ordersTypeFilterSelect,
      addOrderItemButton,
      newOrderButton,
      toggleOrdersBatchButton,
      closeOrdersBatchButton,
      ordersBatchPanel,
      addOrderBatchButton,
      ordersBatchSelect,
      saveOrdersButton,
      deleteOrderButton,
      clearOrderButton,
      ordersTableBody,
      ordersSavedList,
    } = refs || {};

    const rerenderInstances = renderInstancesTable || (() => {});
    if (instancesSearchInput) instancesSearchInput.addEventListener("input", rerenderInstances);
    if (instancesFamilyFilterSelect)
      instancesFamilyFilterSelect.addEventListener("change", rerenderInstances);
    if (instancesProducerFilterSelect)
      instancesProducerFilterSelect.addEventListener("change", rerenderInstances);
    if (instancesStoreFilterSelect)
      instancesStoreFilterSelect.addEventListener("change", rerenderInstances);

    if (saveInstancesButton && handleSaveInstances) {
      saveInstancesButton.addEventListener("click", handleSaveInstances);
    }
    if (addQuickProductButton && handleAddQuickProduct) {
      addQuickProductButton.addEventListener("click", handleAddQuickProduct);
    }
    if (addQuickExtraButton && handleAddQuickExtra) {
      addQuickExtraButton.addEventListener("click", handleAddQuickExtra);
    }

    if (shoppingListContainer && handleShoppingListClick) {
      shoppingListContainer.addEventListener("click", handleShoppingListClick);
    }
    if (copyListButton && handleCopyList) {
      copyListButton.addEventListener("click", handleCopyList);
    }

    if (exportBackupButton && handleExportBackup) {
      exportBackupButton.addEventListener("click", handleExportBackup);
    }
    if (importBackupButton && triggerImportBackup) {
      importBackupButton.addEventListener("click", triggerImportBackup);
    }
    if (backupFileInput && handleBackupFileChange) {
      backupFileInput.addEventListener("change", handleBackupFileChange);
    }
    if (exportAlmacenCsvButton && handleExportAlmacenCsv) {
      exportAlmacenCsvButton.addEventListener("click", handleExportAlmacenCsv);
    }
    if (exportOtrosCsvButton && handleExportOtrosCsv) {
      exportOtrosCsvButton.addEventListener("click", handleExportOtrosCsv);
    }
    if (exportStoresCsvButton && handleExportStoresCsv) {
      exportStoresCsvButton.addEventListener("click", handleExportStoresCsv);
    }

    if (ordersStoreSelect && handleOrdersStoreChange) {
      ordersStoreSelect.addEventListener("change", handleOrdersStoreChange);
    }
    if (ordersPlannedDate && handleOrderMetaChange) {
      ordersPlannedDate.addEventListener("change", handleOrderMetaChange);
    }
    if (ordersNameInput && handleOrderMetaChange) {
      ordersNameInput.addEventListener("input", handleOrderMetaChange);
    }
    if (ordersFamilyFilterSelect && handleOrdersFilterChange) {
      ordersFamilyFilterSelect.addEventListener("change", handleOrdersFilterChange);
    }
    if (ordersTypeFilterSelect && handleOrdersFilterChange) {
      ordersTypeFilterSelect.addEventListener("change", handleOrdersFilterChange);
    }
    if (addOrderItemButton && handleAddOrderItem) {
      addOrderItemButton.addEventListener("click", handleAddOrderItem);
    }
    if (newOrderButton && handleNewOrder) {
      newOrderButton.addEventListener("click", handleNewOrder);
    }
    if (toggleOrdersBatchButton && handleToggleOrdersBatchPanel) {
      toggleOrdersBatchButton.addEventListener("click", handleToggleOrdersBatchPanel);
    }
    if (closeOrdersBatchButton && handleCloseOrdersBatchPanel) {
      closeOrdersBatchButton.addEventListener("click", handleCloseOrdersBatchPanel);
    }
    if (addOrderBatchButton && handleAddOrderBatch) {
      addOrderBatchButton.addEventListener("click", handleAddOrderBatch);
    }
    if (saveOrdersButton && handleSaveOrders) {
      saveOrdersButton.addEventListener("click", handleSaveOrders);
    }
    if (deleteOrderButton && handleDeleteOrder) {
      deleteOrderButton.addEventListener("click", handleDeleteOrder);
    }
    if (clearOrderButton && handleClearOrder) {
      clearOrderButton.addEventListener("click", handleClearOrder);
    }
    if (ordersTableBody && handleOrdersTableClick) {
      ordersTableBody.addEventListener("click", handleOrdersTableClick);
    }
    if (ordersSavedList && handleOrdersSavedClick) {
      ordersSavedList.addEventListener("click", handleOrdersSavedClick);
    }

  }

  function initPopups(refs, handlers = {}) {
    const {
      closeSelectionPopup,
      handleSelectionPopupResize,
      handleSelectionPopupKeydown,
      initHorizontalTableScroll,
    } = handlers;

    const { selectionPopupClose, selectionPopupOverlay } = refs || {};

    if (selectionPopupClose && closeSelectionPopup) {
      selectionPopupClose.addEventListener("click", closeSelectionPopup);
    }
    if (selectionPopupOverlay && closeSelectionPopup) {
      selectionPopupOverlay.addEventListener("click", (e) => {
        if (e.target === selectionPopupOverlay) closeSelectionPopup();
      });
    }

    if (typeof handleSelectionPopupResize === "function") {
      window.addEventListener("resize", handleSelectionPopupResize);
    }
    if (typeof handleSelectionPopupKeydown === "function") {
      document.addEventListener("keydown", handleSelectionPopupKeydown);
    }
    if (typeof initHorizontalTableScroll === "function") {
      initHorizontalTableScroll();
    }
  }

  window.AppBootstrap = {
    collectRefs,
    initMainNav,
    initFilters,
    initPopups,
  };
})();
