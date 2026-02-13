-- CreateIndex
CREATE UNIQUE INDEX "filings_project_id_dms_ref_key" ON "filings"("project_id", "dms_ref");

-- CreateIndex
CREATE UNIQUE INDEX "litigations_project_id_case_number_key" ON "litigations"("project_id", "case_number");
