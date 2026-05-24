"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCandidates } from "@/hooks/useCandidates";
import {
  addCandidate,
  deleteCandidate,
  updateCandidate,
} from "@/lib/candidates-store";
import SaveErrorBanner, {
  toSaveErrorInfo,
  type SaveErrorInfo,
} from "@/components/SaveErrorBanner";
import CandidateRow from "@/components/edit/CandidateRow";
import RankLegend from "@/components/RankLegend";
import editStyles from "@/components/edit/Edit.module.css";
import rowStyles from "@/components/edit/CandidateRow.module.css";
import { getCandidateImages, type EditableCandidate } from "@/types";

function nextOrder(list: ReadonlyArray<EditableCandidate>): number {
  if (list.length === 0) return 0;
  return Math.max(...list.map(c => c.order)) + 1;
}

function emptyDraft(order: number): EditableCandidate {
  return {
    id: "__new__",
    name: "",
    pref: "",
    lon: 0,
    lat: 0,
    image: null,
    images: null,
    desc: null,
    rank: "C",
    order,
  };
}

export default function EditCandidatesPage() {
  const { user } = useAuth();
  const { candidates, loading } = useCandidates();
  const [error, setError] = useState<SaveErrorInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<EditableCandidate | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(prev => (prev === msg ? null : prev)), 2500);
  };

  const handleSave = useCallback(
    async (id: string, patch: EditableCandidate) => {
      try {
        const normalized = {
          name: patch.name.trim(),
          pref: patch.pref.trim(),
          lon: patch.lon,
          lat: patch.lat,
          images: getCandidateImages(patch),
          desc: patch.desc ?? null,
          rank: patch.rank,
          order: patch.order,
        };
        if (id === "__new__") {
          const newId = await addCandidate(normalized, user?.uid ?? null);
          showToast(`added · ${newId.slice(0, 6)}`);
          setNewDraft(null);
        } else {
          await updateCandidate(id, normalized);
          showToast("saved");
        }
      } catch (err) {
        console.error("[candidate save] failed", err);
        setError(toSaveErrorInfo(err));
        throw err;
      }
    },
    [user],
  );

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteCandidate(id);
      showToast("deleted");
    } catch (err) {
      console.error("[candidate delete] failed", err);
      setError(toSaveErrorInfo(err));
      throw err;
    }
  }, []);

  const handleAdd = () => {
    if (newDraft) return;
    setNewDraft(emptyDraft(nextOrder(candidates)));
  };

  return (
    <div className={editStyles.page}>
      <div className={editStyles.heading}>
        <span className={editStyles.title}>Candidates</span>
        <span className={editStyles.subtitle}>
          {candidates.length} entries · {loading ? "loading…" : "live"}
        </span>
      </div>

      <RankLegend
        variant="operator"
        title="Rank の意味 (このプロジェクトでの使い分け)"
      />

      <div className={editStyles.actions}>
        <button
          className={`${editStyles.btn} ${editStyles.btnPrimary}`}
          onClick={handleAdd}
          disabled={newDraft !== null}
          type="button"
        >
          + Add candidate
        </button>
      </div>

      <div>
        <div className={rowStyles.headerRow}>
          <div className={rowStyles.rankCell}>RANK</div>
          <div>NAME</div>
          <div>CATEGORY</div>
          <div>PREF</div>
          <div>LON</div>
          <div>LAT</div>
          <div>ORDER</div>
          <div>IMAGE</div>
          <div />
        </div>

        {newDraft && (
          <CandidateRow
            initial={newDraft}
            isNew
            onSave={handleSave}
            onDelete={() => Promise.resolve()}
            onCancelNew={() => setNewDraft(null)}
          />
        )}

        {candidates.length === 0 && !newDraft && !loading && (
          <div className={editStyles.empty}>
            no candidates yet — use “+ Add candidate” or /edit/map
          </div>
        )}

        {candidates.map(c => (
          <CandidateRow
            key={c.id}
            initial={c}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {toast && <div className={editStyles.toast}>{toast}</div>}
      <SaveErrorBanner error={error} onDismiss={() => setError(null)} />
    </div>
  );
}
