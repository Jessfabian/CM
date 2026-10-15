(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const files = { app: null, ill: null };
  let selectedDocuments = [];
  let nextDocumentId = 1;
  const applicationLabels = {
    insuredName: "Insured name", plan: "Plan", faceAmount: "Face amount",
    apl: "Automatic Premium Loan", loanRate: "Loan rate",
    dividend: "Dividend option", waiver: "Waiver of Premium", gir: "GIR",
    rtr: "RTR", lisr: "LISR", lisrTfa: "LISR Target Face Amount",
    lisrModal: "LISR Modal Payment", lisrLumpSum: "LISR Unscheduled Lump Sum",
    frequency: "Payment frequency",
    signedDate: "Signature date", signatureEvidence: "Signature evidence"
  };
  const illustrationLabels = {
    ...applicationLabels,
    alirModal: "ALIR Modal Payment", alirDuration: "ALIR Payment Duration",
    alirUnscheduled: "ALIR Unscheduled"
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function showError(message = "") {
    $("errorBox").textContent = message;
    $("errorBox").style.display = message ? "block" : "none";
  }

  function showWarnings(messages = []) {
    const warningBox = $("warningBox");
    warningBox.textContent = messages.join(" ");
    warningBox.hidden = messages.length === 0;
  }

  function updateButtons() {
    const roles = selectedDocuments.map((entry) => entry.role);
    const ready = Boolean(files.app && files.ill);
    const duplicateRole = ["app", "ill"].some(
      (role) => roles.filter((selectedRole) => selectedRole === role).length > 1,
    );
    $("extractBtn").disabled = !ready;
    $("runStatus").textContent = ready
      ? "Ready for Python extraction"
      : duplicateRole
        ? "Choose one Part 1 and one illustration"
        : "Add and assign both PDFs";
    $("runStatus").className = `status ${ready ? "good" : "pending"}`;
  }

  function formatDuration(seconds) {
    const totalSeconds = Math.max(1, Math.ceil(Number(seconds) || 0));
    if (totalSeconds < 60) return `about ${totalSeconds} sec`;
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return remainingSeconds
      ? `about ${minutes} min ${remainingSeconds} sec`
      : `about ${minutes} min`;
  }

  function inferDocumentRole(file) {
    const name = file.name.toLowerCase();
    const application = /\bapplication\b|\bapp\b|\bpart[\s_-]*1\b/.test(name);
    const illustration = /\billustration\b/.test(name);
    if (application === illustration) return "";
    return application ? "app" : "ill";
  }

  function syncAssignedFiles() {
    for (const role of ["app", "ill"]) {
      const matches = selectedDocuments.filter((entry) => entry.role === role);
      files[role] = matches.length === 1 ? matches[0].file : null;
      $(`${role}Meta`).textContent = files[role]
        ? `${role === "app" ? "Part 1" : "Illustration"}: ${files[role].name} • ${(files[role].size / 1048576).toFixed(2)} MB`
        : `${role === "app" ? "Part 1" : "Illustration"}: no file assigned`;
    }
  }

  function renderDocumentList() {
    const host = $("documentList");
    host.replaceChildren();
    selectedDocuments.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "file-entry";

      const name = document.createElement("span");
      name.className = "file-name";
      name.textContent = `${entry.file.name} • ${(entry.file.size / 1048576).toFixed(2)} MB`;

      const role = document.createElement("select");
      role.setAttribute("aria-label", `Document type for ${entry.file.name}`);
      role.innerHTML = `
        <option value="">Choose document type</option>
        <option value="app">Part 1 application</option>
        <option value="ill">Sales illustration</option>`;
      role.value = entry.role;
      role.addEventListener("change", () => {
        entry.role = role.value;
        syncAssignedFiles();
        updateButtons();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "file-remove";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${entry.file.name}`);
      remove.addEventListener("click", () => {
        selectedDocuments = selectedDocuments.filter(
          (candidate) => candidate.id !== entry.id,
        );
        renderDocumentList();
      });

      row.append(name, role, remove);
      host.appendChild(row);
    });
  }

  function addDocuments(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    if (incoming.some((file) => !/\.pdf$/i.test(file.name))) {
      showError("Please add PDF files only.");
      return;
    }
    if (incoming.length > 2) {
      showError("Select or drop the two PDFs for this validation.");
      return;
    }

    const next = incoming.length === 2 ? [] : [...selectedDocuments];
    for (const file of incoming) {
      const role = inferDocumentRole(file);
      const existingIndex = role
        ? next.findIndex((entry) => entry.role === role)
        : -1;
      const newEntry = { id: nextDocumentId++, file, role };
      if (existingIndex >= 0 && incoming.length === 1) {
        next[existingIndex] = newEntry;
      } else if (next.length < 2) {
        next.push(newEntry);
      } else {
        showError("Remove a selected PDF before adding another.");
        return;
      }
    }

    selectedDocuments = next;
    showError();
    renderDocumentList();
    syncAssignedFiles();
    updateButtons();
  }

  function setupDocumentDrop() {
    const zone = $("documentsDrop");
    const input = $("documentFiles");
    input.addEventListener("change", () => {
      addDocuments(input.files);
      input.value = "";
    });
    ["dragenter", "dragover"].forEach((name) => zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.add("drag");
    }));
    ["dragleave", "drop"].forEach((name) => zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.remove("drag");
    }));
    zone.addEventListener("drop", (event) => addDocuments(event.dataTransfer.files));
  }

  function pythonFieldToUi(entry = {}) {
    return {
      v: entry.value || "",
      c: Number(entry.confidence) || 0,
      pageNumber: entry.page_number || "",
      source: entry.source || "",
      matchedLabel: entry.matched_label || "",
      excluded: Boolean(entry.excluded),
      warnings: entry.warnings || []
    };
  }

  function renderFields(kind, documentResult) {
    const host = $(`${kind}Fields`);
    host.innerHTML = "";
    const fields = documentResult.fields || {};
    const labels = kind === "app" ? applicationLabels : illustrationLabels;
    Object.keys(labels).forEach((key) => {
      const entry = pythonFieldToUi(fields[key]);
      const card = document.createElement("article");
      const confidenceClass = entry.excluded ? "excluded" : entry.c >= 85 ? "high" : entry.c < 50 ? "low" : "medium";
      card.className = `field ${confidenceClass}`;
      card.innerHTML = `
        <div class="field-heading">
          <strong>${escapeHtml(labels[key])}</strong>
          <span class="confidence">${entry.excluded ? "N/A" : `${entry.c}%`}</span>
        </div>
        <input data-kind="${kind}" data-key="${key}" value="${escapeHtml(entry.v)}" aria-label="${escapeHtml(labels[key])}">
        <small>${entry.pageNumber ? `Page ${entry.pageNumber} • ` : ""}${escapeHtml(entry.source || "No source identified")}</small>
      `;
      host.appendChild(card);
    });
  }

  function extractedText(documentResult) {
    return (documentResult.pages || []).map((page) => `PAGE ${page.page_number} [${page.source}]\n${page.text || ""}`).join("\n\n");
  }

  function renderResults(report) {
    const summary = report.summary || {};
    $("summaryCards").hidden = false;
    $("matchCount").textContent = summary.matches || 0;
    $("mismatchCount").textContent = summary.mismatches || 0;
    $("reviewCount").textContent = summary.reviews || 0;
    $("excludedCount").textContent = summary.excluded || 0;

    const rows = report.comparison || [];
    $("results").className = "table-wrap";
    $("results").innerHTML = `
      <table>
        <thead><tr><th>Field</th><th>Part 1</th><th>Illustration</th><th>Result</th><th>Note</th></tr></thead>
        <tbody>${rows.map((row) => {
          const cls = row.status === "Match" ? "good" : row.status === "Mismatch" || row.status === "Failed" ? "bad" : "warn";
          return `<tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(row.application)}</td>
            <td>${escapeHtml(row.illustration)}</td>
            <td><span class="status ${cls}">${escapeHtml(row.status)}</span></td>
            <td>${escapeHtml(row.note)}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>`;
  }

  async function validate() {
    showError();
    showWarnings();
    $("extractBtn").disabled = true;
    $("runStatus").textContent = "Estimating review time…";
    $("runStatus").className = "status warn";
    $("appProgress").style.width = "0%";
    $("illProgress").style.width = "0%";

    const form = new FormData();
    form.append("application", files.app);
    form.append("illustration", files.ill);
    form.append("state", $("state").value);

    try {
      const response = await fetch("/api/validate-stream", {
        method: "POST",
        body: form
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Validation failed.");
      }
      if (!response.body) throw new Error("Progress streaming is unavailable in this browser.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let report = null;

      function handleEvent(event) {
        if (event.type === "error") {
          throw new Error(event.message || "Validation failed.");
        }

        if (event.type === "complete") {
          report = event.report;
          $("appProgress").style.width = "100%";
          $("illProgress").style.width = "100%";
          return;
        }

        if (event.type !== "progress") return;

        const percent = Number(event.percent) || 0;
        $("runStatus").textContent =
          `${event.message} · Estimated time remaining: ` +
          formatDuration(event.estimatedRemainingSeconds);
        $("runStatus").className = "status warn";

        if (event.stage === "application" && event.totalPages) {
          $("appProgress").style.width =
            `${Math.round(event.completedPages / event.totalPages * 100)}%`;
        } else if (event.stage === "illustration" && event.totalPages) {
          $("appProgress").style.width = "100%";
          $("illProgress").style.width =
            `${Math.round(event.completedPages / event.totalPages * 100)}%`;
        } else if (event.stage === "comparison" || event.stage === "output") {
          $("appProgress").style.width = "100%";
          $("illProgress").style.width = `${Math.min(100, percent)}%`;
        }
      }

      while (true) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = pending.split("\n");
        pending = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) handleEvent(JSON.parse(line));
        }
        if (done) break;
      }
      if (pending.trim()) handleEvent(JSON.parse(pending));
      if (!report) throw new Error("The validation service ended before returning results.");

      if (report.application.errors?.length || report.illustration.errors?.length) {
        throw new Error([...report.application.errors, ...report.illustration.errors].join(" "));
      }

      renderFields("app", report.application);
      renderFields("ill", report.illustration);
      $("appText").value = extractedText(report.application);
      $("illText").value = extractedText(report.illustration);
      renderResults(report);
      const warnings = [
        ...(report.application.warnings || []).map((warning) => `Part 1: ${warning}`),
        ...(report.illustration.warnings || []).map((warning) => `Illustration: ${warning}`)
      ];
      const missingApplicationFields = [
        ["insuredName", "insured name"],
        ["plan", "plan"],
        ["faceAmount", "face amount"],
        ["frequency", "payment frequency"]
      ]
        .filter(([key]) => !report.application.fields?.[key]?.value)
        .map(([, label]) => label);
      if (missingApplicationFields.length) {
        warnings.push(
          `Part 1 values not identified: ${missingApplicationFields.join(", ")}. ` +
          "Check the extracted text and review these fields manually."
        );
      }
      showWarnings(warnings);
      $("appProgress").style.width = "100%";
      $("illProgress").style.width = "100%";
      $("runStatus").textContent = "Extraction and validation complete";
      $("runStatus").className = "status good";
    } catch (error) {
      console.error(error);
      showError(error.message || "The Python validation service could not process the PDFs.");
      $("runStatus").textContent = "Validation failed";
      $("runStatus").className = "status bad";
    } finally {
      $("extractBtn").disabled = false;
    }
  }

  async function healthCheck() {
    try {
      const response = await fetch("/api/health");
      if (!response.ok) throw new Error();
      const health = await response.json();
      const missingTools = [];
      if (!health.ocrAvailable) missingTools.push("Tesseract with English language data");
      if (!health.pdfRendererAvailable) missingTools.push("Poppler");
      if (missingTools.length) {
        $("serverBadge").textContent = "OCR setup incomplete";
        $("serverBadge").className = "status warn";
        showWarnings([
          `Install ${missingTools.join(" and ")} and restart the Python service. ` +
          "Image-based or encoded PDFs may not extract correctly until OCR is available."
        ]);
      } else {
        $("serverBadge").textContent = "Python service ready";
        $("serverBadge").className = "status good";
        showWarnings();
      }
    } catch {
      $("serverBadge").textContent = "Python service unavailable";
      $("serverBadge").className = "status bad";
      showError("Start the site with: python app.py. Do not open index.html directly.");
    }
  }

  $("state").addEventListener("change", () => {
    const ny = $("state").value === "NY";
    $("ruleBadge").textContent = ny ? "NY Reg 74 checks enabled" : "Standard rules";
    $("ruleBadge").className = `status ${ny ? "warn" : "pending"}`;
  });
  $("extractBtn").addEventListener("click", validate);
  $("resetBtn").addEventListener("click", () => window.location.reload());
  setupDocumentDrop();
  syncAssignedFiles();
  updateButtons();
  healthCheck();
})();
