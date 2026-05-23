"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCandidates } from "@/hooks/useCandidates";
import {
  addCandidate,
  deleteCandidate,
  updateCandidate,
} from "@/lib/candidates-store";
import { nearestPrefecture } from "@/lib/japan-data";
import SaveErrorBanner, {
  toSaveErrorInfo,
  type SaveErrorInfo,
} from "@/components/SaveErrorBanner";
import PinDraftPanel, {
  type DraftForm,
} from "@/components/edit/PinDraftPanel";
import editStyles from "@/components/edit/Edit.module.css";
import styles from "./page.module.css";
import { getCandidateImages, type LatLon } from "@/types";

// Leaflet は window を参照するので client-only
const EditMap = dynamic(() => import("@/components/edit/EditMap"), {
  ssr: false,
});

const EMPTY_FORM: DraftForm = {
  name: "",
  category: "",
  pref: "",
  rank: "C",
  images: [],
  desc: "",
};

export default function EditMapPage() {
  const { user } = useAuth();
  const { candidates, loading } = useCandidates();
  const [pin, setPin] = useState<LatLon | null>(null);
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SaveErrorInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const suggestedPref = pin ? nearestPrefecture(pin.lon, pin.lat) : null;
  const editingOrder =
    editingId !== null
      ? candidates.find(c => c.id === editingId)?.order ?? null
      : null;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(prev => (prev === msg ? null : prev)), 2400);
  };

  const handlePick = useCallback((ll: LatLon) => {
    // Map blank-area click → start a new point (cancels any edit in progress).
    setEditingId(null);
    setPin(ll);
    setForm(EMPTY_FORM);
    setError(null);
  }, []);

  const handleDraftMove = useCallback((ll: LatLon) => {
    setPin(ll);
  }, []);

  const handleClear = useCallback(() => {
    setPin(null);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
  }, []);

  const handleEditExisting = useCallback(
    (id: string) => {
      const c = candidates.find(x => x.id === id);
      if (!c) return;
      setEditingId(id);
      setPin({ lat: c.lat, lon: c.lon });
      setForm({
        name: c.name,
        category: c.category ?? "",
        pref: c.pref,
        rank: c.rank,
        images: getCandidateImages(c),
        desc: c.desc ?? "",
      });
      setError(null);
    },
    [candidates],
  );

  const handleSave = useCallback(async () => {
    if (!pin) return;
    const name = form.name.trim();
    const pref = form.pref.trim();
    if (!name || !pref) return;
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await updateCandidate(editingId, {
          name,
          pref,
          lon: pin.lon,
          lat: pin.lat,
          images: form.images,
          desc: form.desc.trim() || null,
          category: form.category.trim() || null,
          rank: form.rank,
          // order is preserved (we don't change it on edit)
          ...(editingOrder !== null ? { order: editingOrder } : {}),
        });
        showToast(`updated · ${name}`);
      } else {
        const order =
          candidates.length === 0
            ? 0
            : Math.max(...candidates.map(c => c.order)) + 1;
        await addCandidate(
          {
            name,
            pref,
            lon: pin.lon,
            lat: pin.lat,
            images: form.images,
            desc: form.desc.trim() || null,
            category: form.category.trim() || null,
            rank: form.rank,
            order,
          },
          user?.uid ?? null,
        );
        showToast(`added · ${name}`);
      }
      setPin(null);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      console.error("[map save] failed", err);
      setError(toSaveErrorInfo(err));
    } finally {
      setBusy(false);
    }
  }, [pin, form, candidates, user, editingId, editingOrder]);

  const handleDelete = useCallback(async () => {
    if (!editingId) return;
    const target = candidates.find(c => c.id === editingId);
    const label = target?.name ? `「${target.name}」` : "この地点";
    if (!window.confirm(`${label} を削除しますか? この操作は取り消せません。`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteCandidate(editingId);
      showToast(`deleted${target?.name ? ` · ${target.name}` : ""}`);
      setPin(null);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      console.error("[map delete] failed", err);
      setError(toSaveErrorInfo(err));
    } finally {
      setBusy(false);
    }
  }, [editingId, candidates]);

  return (
    <div className={styles.layout}>
      <div className={styles.mapSlot}>
        {!loading && (
          <EditMap
            existing={candidates}
            draft={pin}
            editingId={editingId}
            onPick={handlePick}
            onDraftMove={handleDraftMove}
            onEditExisting={handleEditExisting}
          />
        )}
      </div>
      <PinDraftPanel
        pin={pin}
        form={form}
        mode={editingId ? "edit" : "new"}
        suggestedPref={suggestedPref}
        busy={busy}
        onChange={setForm}
        onClear={handleClear}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      {toast && <div className={editStyles.toast}>{toast}</div>}
      <SaveErrorBanner error={error} onDismiss={() => setError(null)} />
    </div>
  );
}
