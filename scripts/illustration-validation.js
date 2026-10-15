(() => {
  "use strict";

  const API_BASE = String(window.VALIDATOR_API_BASE || "").replace(/\/+$/, "");
  const API_URL = `${API_BASE}/api/validate-stream`;

  const validatorState = {
    applicationFile: null,
    illustrationFile: null,
    selectedDocuments: [],
    nextDocumentId: 1,
    report: null,
    mismatches: [],
  };

  const fieldLabels = {
    insuredName: "Insured name",
    plan: "Plan",
    faceAmount: "Face amount",
    apl: "Automatic Premium Loan",
    loanRate: "Loan rate",
    dividend: "Dividend option",
    waiver: "Waiver of Premium",
    gir: "GIR",
    rtr: "RTR",
    lisr: "LISR",
    lisrTfa: "LISR Target Face Amount",
    lisrModal: "LISR Modal Payment",
    lisrLumpSum: "LISR Unscheduled Lump Sum",
    alirModal: "ALIR Modal Payment",
    alirDuration: "ALIR Payment Duration",
    alirUnscheduled: "ALIR Unscheduled",
    frequency: "Payment frequency",
    signedDate: "Signature date",
    signatureEvidence: "Signature evidence",
    applicationCityState: "Application signed in",
  };
  const applicationFieldLabels = Object.fromEntries(
    Object.entries(fieldLabels).filter(
      ([key]) =>
        !["alirModal", "alirDuration", "alirUnscheduled"].includes(key),
    ),
  );
  const illustrationFieldLabels = Object.fromEntries(
    Object.entries(fieldLabels).filter(
      ([key]) => key !== "applicationCityState",
    ),
  );

  function getElement(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character],
    );
  }

  function showValidationError(message = "") {
    const errorElement = getElement("irValidationError");

    if (!errorElement) {
      return;
    }

    errorElement.textContent = message;
    errorElement.hidden = !message;
  }

  function updateRunButton() {
    const runButton = getElement("irRunValidationButton");

    const statusElement = getElement("irValidationRunStatus");

    const ready = Boolean(
      validatorState.applicationFile && validatorState.illustrationFile,
    );

    runButton.disabled = !ready;

    statusElement.textContent = ready
      ? "Ready for validation"
      : "Waiting for both PDFs";

    statusElement.className = ready
      ? "validation-status validation-status-good"
      : "validation-status validation-status-pending";
  }

  function validatePdfFile(file) {
    if (!file) {
      return false;
    }

    const fileName = file.name.toLowerCase();

    return file.type === "application/pdf" || fileName.endsWith(".pdf");
  }

  function inferDocumentType(file) {
    const name = file.name.toLowerCase();
    const isApplication =
      /\bapplication\b|\bapp\b|\bpart[\s_-]*1\b/.test(name);
    const isIllustration = /\billustration\b/.test(name);

    if (isApplication === isIllustration) {
      return "";
    }

    return isApplication ? "application" : "illustration";
  }

  function syncAssignedDocuments() {
    const assigned = {};
    for (const type of ["application", "illustration"]) {
      const matches = validatorState.selectedDocuments.filter(
        (entry) => entry.type === type,
      );
      assigned[type] = matches.length === 1 ? matches[0].file : null;
    }

    validatorState.applicationFile = assigned.application;
    validatorState.illustrationFile = assigned.illustration;

    getElement("irApplicationFileMeta").textContent = assigned.application
      ? formatFileDescription(assigned.application)
      : "No application selected";
    getElement("irIllustrationFileMeta").textContent = assigned.illustration
      ? formatFileDescription(assigned.illustration)
      : "No illustration selected";

    const applicationStatus = getElement("applicationUploadStatus");
    const illustrationStatus = getElement("illustrationUploadStatus");
    if (applicationStatus) {
      applicationStatus.textContent = assigned.application
        ? "✓ Uploaded"
        : "Not Uploaded";
    }
    if (illustrationStatus) {
      illustrationStatus.textContent = assigned.illustration
        ? "✓ Uploaded"
        : "Not Uploaded";
    }
  }

  function renderDocumentList() {
    const host = getElement("irDocumentList");
    if (!host) return;

    host.replaceChildren();
    validatorState.selectedDocuments.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "validation-document-entry";

      const name = document.createElement("span");
      name.className = "validation-document-name";
      name.textContent = formatFileDescription(entry.file);

      const role = document.createElement("select");
      role.setAttribute(
        "aria-label",
        `Document type for ${entry.file.name}`,
      );
      role.innerHTML = `
        <option value="">Choose document type</option>
        <option value="application">Part 1 application</option>
        <option value="illustration">Sales illustration</option>`;
      role.value = entry.type;
      role.addEventListener("change", () => {
        entry.type = role.value;
        syncAssignedDocuments();
        updateRunButton();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "validation-document-remove";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${entry.file.name}`);
      remove.addEventListener("click", () => {
        validatorState.selectedDocuments =
          validatorState.selectedDocuments.filter(
            (candidate) => candidate.id !== entry.id,
          );
        renderDocumentList();
        syncAssignedDocuments();
        updateRunButton();
      });

      row.append(name, role, remove);
      host.appendChild(row);
    });
  }

  function addSelectedDocuments(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    if (incoming.some((file) => !validatePdfFile(file))) {
      showValidationError("Please add PDF files only.");
      return;
    }
    if (incoming.length > 2) {
      showValidationError("Select or drop the two PDFs for this validation.");
      return;
    }

    const next = incoming.length === 2
      ? []
      : [...validatorState.selectedDocuments];
    for (const file of incoming) {
      const type = inferDocumentType(file);
      const existingIndex = type
        ? next.findIndex((entry) => entry.type === type)
        : -1;
      const newEntry = {
        id: validatorState.nextDocumentId++,
        file,
        type,
      };

      if (existingIndex >= 0 && incoming.length === 1) {
        next[existingIndex] = newEntry;
      } else if (next.length < 2) {
        next.push(newEntry);
      } else {
        showValidationError("Remove a selected PDF before adding another.");
        return;
      }
    }

    validatorState.selectedDocuments = next;
    showValidationError("");
    renderDocumentList();
    syncAssignedDocuments();
    updateRunButton();
  }

  function formatFileDescription(file) {
    const sizeInMegabytes = (file.size / 1024 / 1024).toFixed(2);

    return `${file.name} • ${sizeInMegabytes} MB`;
  }

  function formatEstimatedDuration(seconds) {
    const totalSeconds = Math.max(1, Math.ceil(Number(seconds) || 0));
    if (totalSeconds < 60) {
      return `about ${totalSeconds} sec`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return remainingSeconds
      ? `about ${minutes} min ${remainingSeconds} sec`
      : `about ${minutes} min`;
  }

  function configureDocumentDropZone() {
    const dropZone = getElement("irDocumentDropZone");
    const fileInput = getElement("irDocumentFiles");

    if (!dropZone || !fileInput) {
      return;
    }

    fileInput.addEventListener("change", () => {
      addSelectedDocuments(fileInput.files);
      fileInput.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();

        dropZone.classList.add("is-dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();

        dropZone.classList.remove("is-dragging");
      });
    });

    dropZone.addEventListener("drop", (event) => {
      addSelectedDocuments(event.dataTransfer?.files);
    });
  }

  async function checkValidatorService() {
    const serviceStatus = getElement("irValidatorServiceStatus");

    if (!serviceStatus) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/health`);

      if (!response.ok) {
        throw new Error("Service health check failed.");
      }

      serviceStatus.textContent = "Python service ready";

      serviceStatus.className = "validation-status " + "validation-status-good";
    } catch (error) {
      console.error(error);

      serviceStatus.textContent = "Python service unavailable";

      serviceStatus.className =
        "validation-status " + "validation-status-error";
    }
  }

  function markStepComplete(stepId) {
    const step = getElement(stepId);

    if (!step) {
      return;
    }

    step.classList.remove("active", "pending");
    step.classList.add("complete");

    const icon = step.querySelector(".step-icon");
    if (icon) {
      icon.textContent = "✓";
    }
  }

  function markPreviousStepsComplete(stage) {
    if (["illustration", "comparison", "output", "complete"].includes(stage)) {
      markStepComplete("stepReadApplication");
    }

    if (["comparison", "output", "complete"].includes(stage)) {
      markStepComplete("stepReadIllustration");
    }

    if (["output", "complete"].includes(stage)) {
      markStepComplete("stepCompareValues");
    }

    if (stage === "complete") {
      markStepComplete("stepReviewOutput");
    }
  }

  function updateValidationProgress({
    percent = 0,
    stage = "",
    message = "Processing documents",
    estimatedRemainingSeconds,
  }) {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    const progressFill = getElement("ivProgressFill");
    const progressPercent = getElement("ivProgressPercent");
    const progressMessage = getElement("ivProgressMessage");
    const estimateElement = getElement("ivEstimatedTime");

    if (progressFill) {
      progressFill.style.width = `${safePercent}%`;
    }

    if (progressPercent) {
      progressPercent.textContent = `${safePercent}%`;
    }

    if (progressMessage) {
      progressMessage.textContent = message;
    }

    if (estimateElement) {
      estimateElement.textContent =
        stage === "complete"
          ? "Estimated time remaining: complete"
          : typeof estimatedRemainingSeconds === "number"
            ? `Estimated time remaining: ${formatEstimatedDuration(
                estimatedRemainingSeconds,
              )}`
            : "Estimated time remaining: calculating…";
    }

    document.querySelectorAll(".iv-step").forEach((step) => {
      step.classList.remove("active");
    });

    const stageMap = {
      application: "stepReadApplication",
      illustration: "stepReadIllustration",
      comparison: "stepCompareValues",
      output: "stepReviewOutput",
    };

    const currentStep = getElement(stageMap[stage]);
    if (currentStep) {
      currentStep.classList.remove("pending");
      currentStep.classList.add("active");
    }

    markPreviousStepsComplete(stage);
  }

  function resetProgressDisplay() {
    const progressFill = getElement("ivProgressFill");
    const progressPercent = getElement("ivProgressPercent");
    const progressMessage = getElement("ivProgressMessage");
    const estimatedTime = getElement("ivEstimatedTime");

    if (progressFill) progressFill.style.width = "0%";
    if (progressPercent) progressPercent.textContent = "0%";
    if (progressMessage) progressMessage.textContent = "Ready to begin";
    if (estimatedTime) {
      estimatedTime.textContent = "Estimated time remaining: calculating…";
    }

    document.querySelectorAll(".iv-step").forEach((step) => {
      step.classList.remove("active", "complete");
      step.classList.add("pending");
      const icon = step.querySelector(".step-icon");
      if (icon) icon.textContent = "○";
    });
  }

  async function runIllustrationValidation() {
    const runButton = getElement("irRunValidationButton");
    const runStatus = getElement("irValidationRunStatus");

    if (!validatorState.applicationFile || !validatorState.illustrationFile) {
      showValidationError("Upload both PDFs before running validation.");
      return;
    }

    if (!runButton || !runStatus) {
      console.error("The validation button or status element is missing.");
      return;
    }

    runButton.disabled = true;
    runStatus.textContent = "Validation in progress";
    runStatus.className = "validation-status validation-status-warning";
    showValidationError("");
    resetProgressDisplay();

    updateValidationProgress({
      percent: 1,
      stage: "application",
      message: "Uploading documents...",
      estimatedRemainingSeconds: undefined,
    });

    const uploadData = new FormData();
    uploadData.append("application", validatorState.applicationFile);
    uploadData.append("illustration", validatorState.illustrationFile);

    const stateField = getElement("irValidationState");
    uploadData.append("state", stateField?.value || "");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: uploadData,
      });

      if (!response.ok) {
        let errorMessage = "Validation request failed.";
        try {
          const errorResult = await response.json();
          errorMessage = errorResult.error || errorMessage;
        } catch (_parseError) {
          // Keep the default message when the error response is not JSON.
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error(
          "The browser could not read the validation progress stream.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let remainingText = "";
      let finalReport = null;

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        remainingText += decoder.decode(value, { stream: true });
        const lines = remainingText.split("\n");
        remainingText = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          const event = JSON.parse(cleanLine);

          if (event.type === "progress") {
            updateValidationProgress(event);
          } else if (event.type === "complete") {
            updateValidationProgress(event);
            finalReport = event.report;
          } else if (event.type === "error") {
            throw new Error(event.message || "Validation failed.");
          }
        }
      }

      if (remainingText.trim()) {
        const event = JSON.parse(remainingText.trim());
        if (event.type === "complete") {
          updateValidationProgress(event);
          finalReport = event.report;
        } else if (event.type === "error") {
          throw new Error(event.message || "Validation failed.");
        }
      }

      if (!finalReport) {
        throw new Error("Validation finished without returning a report.");
      }

      const documentErrors = [
        ...(finalReport.application?.errors || []),
        ...(finalReport.illustration?.errors || []),
      ];

      if (documentErrors.length) {
        throw new Error(documentErrors.join(" "));
      }

      validatorState.report = finalReport;
      validatorState.mismatches = getActionableMismatches(
        finalReport.comparison || [],
      );

      renderValidationReport(finalReport);
      saveValidationToCase(finalReport);

      updateValidationProgress({
        percent: 100,
        stage: "complete",
        message: "Validation complete",
        estimatedRemainingSeconds: 0,
      });

      runStatus.textContent = "Validation complete";
      runStatus.className = "validation-status validation-status-good";
    } catch (error) {
      console.error(error);
      showValidationError(
        error.message || "The documents could not be validated.",
      );
      runStatus.textContent = "Validation failed";
      runStatus.className = "validation-status validation-status-error";
    } finally {
      runButton.disabled = false;
    }
  }

  function getActionableMismatches(rows) {
    return rows.filter(
      (row) =>
        row.status === "Mismatch" ||
        row.status === "Review" ||
        row.status === "Failed",
    );
  }

  function renderValidationReport(report) {
    renderValidationSummary(report.summary || {});

    renderExtractedFields(
      "irApplicationExtractedFields",
      report.application?.fields || {},
      "application",
    );

    renderExtractedFields(
      "irIllustrationExtractedFields",
      report.illustration?.fields || {},
      "illustration",
    );

    getElement("irApplicationExtractedText").value = buildExtractedText(
      report.application?.pages || [],
    );

    getElement("irIllustrationExtractedText").value = buildExtractedText(
      report.illustration?.pages || [],
    );

    renderComparisonTable(report.comparison || []);

    getElement("irValidationSummary").hidden = false;

    getElement("irExtractedValuesArea").hidden = false;

    getElement("irValidationResultsCard").hidden = false;

    getElement("irAddValidationRequirementButton").hidden =
      validatorState.mismatches.length === 0;
  }

  function renderValidationSummary(summary) {
    getElement("irMatchCount").textContent = summary.matches || 0;

    getElement("irMismatchCount").textContent = summary.mismatches || 0;

    getElement("irReviewCount").textContent = summary.reviews || 0;

    getElement("irExcludedCount").textContent = summary.excluded || 0;
  }

  function renderExtractedFields(containerId, fields, documentType) {
    const container = getElement(containerId);

    container.innerHTML = "";

    const labels =
      documentType === "application"
        ? applicationFieldLabels
        : illustrationFieldLabels;

    Object.entries(labels).forEach(([fieldKey, label]) => {
      const field = fields[fieldKey] || {};
      const value = field.value || "";

      const card = document.createElement("article");

      card.className = [
        "validation-field-card",
        getConfidenceClass(field),
      ].join(" ");

      card.innerHTML = `
                    <div class="validation-field-heading">
                        <strong>
                            ${escapeHtml(label)}
                        </strong>

                        <span class="validation-confidence">
                            ${
                              field.excluded
                                ? "N/A"
                                : `${field.confidence || 0}%`
                            }
                        </span>
                    </div>

                    <div class="validation-field-value">
                        ${escapeHtml(value) || "Not found"}
                    </div>

                    <small class="validation-field-source">
                        ${
                          field.page_number
                            ? `Page ${field.page_number} • `
                            : ""
                        }
                        ${escapeHtml(field.source || "No source identified")}
                    </small>
                `;

      container.appendChild(card);
    });
  }

  function getConfidenceClass(field) {
    if (field.excluded) {
      return "is-excluded";
    }

    const confidence = Number(field.confidence || 0);

    if (confidence >= 85) {
      return "is-high";
    }

    if (confidence >= 50) {
      return "is-medium";
    }

    return "is-low";
  }

  function buildExtractedText(pages) {
    return pages
      .map(
        (page) =>
          `PAGE ${page.page_number} ` +
          `[${page.source}]\n` +
          `${page.text || ""}`,
      )
      .join("\n\n");
  }

  function renderComparisonTable(rows) {
    const container = getElement("irValidationComparisonResults");

    const tableRows = rows
      .map(
        (row) => `
            <tr>
                <td>
                    ${escapeHtml(row.label)}
                </td>

                <td>
                    ${escapeHtml(row.application)}
                </td>

                <td>
                    ${escapeHtml(row.illustration)}
                </td>

                <td>
                    ${renderResultBadge(row.status)}
                </td>

                <td>
                    ${escapeHtml(row.note)}
                </td>
            </tr>
        `,
      )
      .join("");

    container.innerHTML = `
            <table class="validation-table">
                <thead>
                    <tr>
                        <th>Field</th>
                        <th>Part 1</th>
                        <th>Illustration</th>
                        <th>Result</th>
                        <th>Review note</th>
                    </tr>
                </thead>

                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;
  }

  function renderResultBadge(status) {
    const statusClassMap = {
      Match: "validation-status-good",
      Mismatch: "validation-status-error",
      Review: "validation-status-warning",
      Excluded: "validation-status-neutral",
      Failed: "validation-status-error",
    };

    const statusClass = statusClassMap[status] || "validation-status-neutral";

    return `
            <span
                class="validation-status ${statusClass}"
            >
                ${escapeHtml(status)}
            </span>
        `;
  }

  function saveValidationToCase(report) {
    /*
     * Shared Full IR result object.
     * Other Full IR scripts can access:
     *
     * window.fullIRIllustrationValidation
     */

    window.fullIRIllustrationValidation = {
      completed: true,
      completedAt: report.generatedAt || new Date().toISOString(),

      state: report.state || "",

      summary: {
        matches: report.summary?.matches || 0,

        mismatches: report.summary?.mismatches || 0,

        reviews: report.summary?.reviews || 0,

        excluded: report.summary?.excluded || 0,

        failed: report.summary?.failed || 0,
      },

      application: report.application?.fields || {},

      illustration: report.illustration?.fields || {},

      comparison: report.comparison || [],

      actionableItems: validatorState.mismatches,
    };

    localStorage.setItem(
      "fullIRIllustrationValidation",
      JSON.stringify(window.fullIRIllustrationValidation),
    );

    document.dispatchEvent(
      new CustomEvent("fullIRIllustrationValidationComplete", {
        detail: window.fullIRIllustrationValidation,
      }),
    );
  }

  function addValidationRequirements() {
    const mismatches = validatorState.mismatches;

    if (!mismatches.length) {
      return;
    }

    mismatches.forEach((row) => {
      const requirementText = buildRequirementText(row);

      addRequirementToFullIR(requirementText, row);
    });

    document.dispatchEvent(new CustomEvent("fullIRRequirementsUpdated"));

    const button = getElement("irAddValidationRequirementButton");

    button.textContent = "Requirements Added";

    button.disabled = true;
  }

  function buildRequirementText(row) {
    if (row.status === "Mismatch") {
      return (
        `Illustration validation mismatch - ` +
        `${row.label}: ` +
        `Part 1 reflects ` +
        `"${row.application}" while the ` +
        `illustration reflects ` +
        `"${row.illustration}". ` +
        `Please provide corrected documentation.`
      );
    }

    return (
      `Illustration validation review required - ` + `${row.label}: ${row.note}`
    );
  }

  function addRequirementToFullIR(requirementText, comparisonRow) {
    /*
     * Use the Full IR requirement function when it
     * already exists.
     */

    if (typeof window.addSavedRequirement === "function") {
      window.addSavedRequirement(requirementText);

      return;
    }

    if (typeof window.addRequirement === "function") {
      window.addRequirement(requirementText);

      return;
    }

    /*
     * Fallback for your shared requirement array.
     */

    window.globalSavedRequirements = window.globalSavedRequirements || [];

    const alreadyExists = window.globalSavedRequirements.some((requirement) => {
      const existingText =
        typeof requirement === "string" ? requirement : requirement.text;

      return existingText === requirementText;
    });

    if (!alreadyExists) {
      window.globalSavedRequirements.push({
        id: `illustration-validation-` + `${comparisonRow.field}`,

        type: "illustration-validation",

        source: "Full Initial Review",

        text: requirementText,

        field: comparisonRow.field,

        applicationValue: comparisonRow.application,

        illustrationValue: comparisonRow.illustration,

        status: comparisonRow.status,

        createdAt: new Date().toISOString(),
      });
    }

    localStorage.setItem(
      "globalSavedRequirements",
      JSON.stringify(window.globalSavedRequirements),
    );
  }

  function resetIllustrationValidation() {
    validatorState.applicationFile = null;
    validatorState.illustrationFile = null;
    validatorState.selectedDocuments = [];
    validatorState.report = null;
    validatorState.mismatches = [];

    resetProgressDisplay();

    const documentInput = getElement("irDocumentFiles");
    if (documentInput) documentInput.value = "";

    renderDocumentList();
    syncAssignedDocuments();

    const applicationStatus = getElement("applicationUploadStatus");
    const illustrationStatus = getElement("illustrationUploadStatus");
    if (applicationStatus) applicationStatus.textContent = "Not Uploaded";
    if (illustrationStatus) illustrationStatus.textContent = "Not Uploaded";

    const summary = getElement("irValidationSummary");
    const extractedArea = getElement("irExtractedValuesArea");
    const resultsCard = getElement("irValidationResultsCard");
    if (summary) summary.hidden = true;
    if (extractedArea) extractedArea.hidden = true;
    if (resultsCard) resultsCard.hidden = true;

    const applicationFields = getElement("irApplicationExtractedFields");
    const illustrationFields = getElement("irIllustrationExtractedFields");
    const applicationText = getElement("irApplicationExtractedText");
    const illustrationText = getElement("irIllustrationExtractedText");
    const comparisonResults = getElement("irValidationComparisonResults");
    if (applicationFields) applicationFields.innerHTML = "";
    if (illustrationFields) illustrationFields.innerHTML = "";
    if (applicationText) applicationText.value = "";
    if (illustrationText) illustrationText.value = "";
    if (comparisonResults) comparisonResults.innerHTML = "";

    const requirementsButton = getElement("irAddValidationRequirementButton");
    if (requirementsButton) {
      requirementsButton.hidden = true;
      requirementsButton.disabled = false;
      requirementsButton.textContent = "Add Mismatches to Requirements";
    }

    showValidationError("");
    updateRunButton();
  }

  function initializeStateIntegration() {
    const validationStateField = getElement("irValidationState");

    if (!validationStateField) {
      return;
    }

    const displayState = () => {
      const display = getElement("validationStateDisplay");
      if (display) {
        display.textContent = validationStateField.value || "Not Selected";
      }

      const ruleBadge = getElement("irValidationRuleBadge");
      if (ruleBadge) {
        const isNewYork = validationStateField.value === "NY";
        ruleBadge.textContent = isNewYork
          ? "NY Reg 74 checks enabled"
          : "Standard comparison rules";
        ruleBadge.className = isNewYork
          ? "validation-status validation-status-warning"
          : "validation-status validation-status-neutral";
      }
    };

    const existingStateField =
      getElement("contractState") ||
      getElement("contractStateSelect") ||
      getElement("caseContractState");

    if (existingStateField?.value) {
      const stateValue = existingStateField.value.trim().toUpperCase();
      validationStateField.value = stateValue === "NY" ? "NY" : "OTHER";
    }

    validationStateField.addEventListener("change", displayState);
    displayState();
  }

  function restoreSavedValidation() {
    try {
      const savedValue = localStorage.getItem("fullIRIllustrationValidation");

      if (!savedValue) {
        return;
      }

      window.fullIRIllustrationValidation = JSON.parse(savedValue);
    } catch (error) {
      console.warn(
        "Could not restore illustration " + "validation results.",
        error,
      );
    }
  }

  function initializeIllustrationValidator() {
    const section = getElement("illustrationValidationSection");

    if (!section) {
      return;
    }

    configureDocumentDropZone();

    getElement("irRunValidationButton").addEventListener(
      "click",
      runIllustrationValidation,
    );

    getElement("irResetValidationButton").addEventListener(
      "click",
      resetIllustrationValidation,
    );

    getElement("irAddValidationRequirementButton").addEventListener(
      "click",
      addValidationRequirements,
    );

    initializeStateIntegration();
    restoreSavedValidation();
    updateRunButton();
    checkValidatorService();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeIllustrationValidator,
    );
  } else {
    initializeIllustrationValidator();
  }
})();
