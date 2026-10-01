import { connection } from "next/server";
import { PipelineStats } from "@/components/PipelineStats";
import { PageTitle } from "@/components/memphis";
import { UploadForm } from "@/components/UploadForm";
import { loadRows } from "@/lib/queries";

export default async function UploadPage() {
  await connection();
  const rows = await loadRows();
  const count = (role: string) => rows.filter((r) => r.appliedRole === role && r.status === "scored").length;

  return (
    <div>
      <div className="border-b border-rule pb-6">
        <PageTitle label="Intake" title="Upload CVs" shape="circle" />
        <p className="mt-2 max-w-[62ch] text-body text-ink-2">
          Pick the role they applied for and add PDF or DOCX CVs. Personal details are split off before any AI step;
          each CV is scored against both the PM and SPM rubrics. Nothing is sent until you confirm it.
        </p>
      </div>
      <div className="mt-8 grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-8">
          <UploadForm />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <PipelineStats
            pm={count("PM")}
            spm={count("SPM")}
            failed={rows.filter((r) => r.status === "failed").length}
            sent={rows.filter((r) => r.email?.status === "sent").length}
          />
        </div>
      </div>
    </div>
  );
}
