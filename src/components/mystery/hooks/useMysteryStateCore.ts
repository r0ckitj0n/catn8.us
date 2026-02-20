import React, { useState } from 'react';
import { ApiClient } from "../../../core/ApiClient";
import { catn8LocalStorageGet, catn8LocalStorageSet } from "../../../utils/storageUtils";
import { IMystery, ICase, IScenario, IJob } from "../../../types/game";
import { IMysteryStateCore } from "../../../types/mysteryHooks";
import { useMysteryBackstoryCore } from './useMysteryBackstoryCore';
export function useMysteryStateCore(
  isAuthed: boolean,
  setError: (err: string) => void,
  setBusy: (busy: boolean) => void
): IMysteryStateCore {
  const [mysteries, setMysteries] = useState<IMystery[]>([]);
  const [mysteryId, setMysteryId] = React.useState(() => catn8LocalStorageGet("catn8_mystery_id") || "");
  const [cachedMysteryTitle, setCachedMysteryTitle] = React.useState(() => catn8LocalStorageGet("catn8_mystery_title") || "");
  const [mysteryPickerList, setMysteryPickerList] = useState<IMystery[]>([]);
  const [mysteryPickerSelectedId, setMysteryPickerSelectedId] = React.useState("");
  const [cases, setCases] = useState<ICase[]>([]);
  const [caseId, setCaseId] = React.useState(() => catn8LocalStorageGet("catn8_case_id") || "");
  const [scenarios, setScenarios] = useState<IScenario[]>([]);
  const [scenarioId, setScenarioId] = React.useState(() => catn8LocalStorageGet("catn8_scenario_id") || "");
  const [scenario, setScenario] = useState<IScenario | null>(null);
  const backstoryCore = useMysteryBackstoryCore(mysteryId, setBusy, setError);
  const { backstories, setBackstories, backstoryId, setBackstoryId, backstoryDetails, setBackstoryDetails, loadBackstories, loadBackstoryDetails, loadBackstoryFullStory, toggleBackstoryArchived } = backstoryCore;
  const [mysteryPickerAdminOpen, setMysteryPickerAdminOpen] = React.useState(false);
  const [mysteryAdminCreateTitle, setMysteryAdminCreateTitle] = React.useState("");
  const [mysteryAdminCreateSlug, setMysteryAdminCreateSlug] = React.useState("");
  const [mysteryAdminEditTitle, setMysteryAdminEditTitle] = React.useState("");
  const [mysteryAdminEditSlug, setMysteryAdminEditSlug] = React.useState("");
  const [mysteryAdminEditArchived, setMysteryAdminEditArchived] = React.useState(false);
  const [mysteryAdminDeleteArmed, setMysteryAdminDeleteArmed] = React.useState(false);
  const [jobs, setJobs] = useState<IJob[]>([]);
  const loadJobs = React.useCallback(async (cid: string | number) => {
    const cidStr = String(cid || "").trim();
    if (!cidStr) {
      setJobs([]);
      return;
    }
    try {
      const res = await ApiClient.get<{ jobs: IJob[] }>("/api/mystery/play.php?action=list_jobs&case_id=" + cidStr);
      setJobs(Array.isArray(res?.jobs) ? res.jobs : []);
    } catch (err: any) {
      console.error("Failed to load jobs:", err);
    }
  }, []);
  const loadMysteries = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await ApiClient.get<{ mysteries: IMystery[] }>("/api/mystery/play.php?action=list_mysteries");
      const list = Array.isArray(res?.mysteries) ? res.mysteries : [];
      setMysteries(list);
      setMysteryPickerList(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load mysteries");
    } finally {
      setBusy(false);
    }
  }, [setBusy, setError]);
  const loadCases = React.useCallback(async (mid: string | number) => {
    const midStr = String(mid || "").trim();
    if (!midStr) {
      setCases([]);
      return [];
    }
    try {
      const res = await ApiClient.get<{ cases: ICase[] }>("/api/mystery/play.php?action=list_cases&mystery_id=" + midStr);
      const list = Array.isArray(res?.cases) ? res.cases : [];
      setCases(list);
      return list;
    } catch (err: any) {
      console.error("Failed to load cases:", err);
      return [];
    }
  }, []);
  const loadScenarios = React.useCallback(async (cid: string | number) => {
    if (!cid) {
      setScenarios([]);
      return [];
    }
    try {
      const res = await ApiClient.get<{ scenarios: IScenario[] }>("/api/mystery/play.php?action=list_scenarios&case_id=" + String(cid));
      const list = Array.isArray(res?.scenarios) ? res.scenarios : [];
      setScenarios(list);
      return list;
    } catch (err: any) {
      console.error("Failed to load scenarios:", err);
      return [];
    }
  }, []);
  React.useEffect(() => {
    if (isAuthed) loadMysteries();
  }, [isAuthed, loadMysteries]);
  React.useEffect(() => {
    const midStr = String(mysteryId || "").trim();
    if (isAuthed && midStr) {
      loadCases(midStr);
    }
  }, [isAuthed, mysteryId, loadCases]);
  React.useEffect(() => {
    const cidStr = String(caseId || "").trim();
    const oldCid = catn8LocalStorageGet("catn8_case_id") || "";
    catn8LocalStorageSet("catn8_case_id", cidStr);
    // If case actually changed, reset scenario state
    if (cidStr !== oldCid) {
      setScenarioId("");
      catn8LocalStorageSet("catn8_scenario_id", "");
      setScenario(null);
    }
    if (isAuthed && cidStr) {
      void loadScenarios(cidStr);
    }
  }, [isAuthed, caseId, loadScenarios]);
  React.useEffect(() => {
    const sidStr = String(scenarioId || "").trim();
    catn8LocalStorageSet("catn8_scenario_id", sidStr);
  }, [scenarioId]);
  const importDefaultMystery = React.useCallback(async () => {
    setBusy(true);
    try {
      await ApiClient.post("/api/mystery/admin.php?action=import_default_mystery", {});
      await loadMysteries();
    } catch (err: any) {
      setError(err?.message || "Failed to import default mystery");
    } finally {
      setBusy(false);
    }
  }, [loadMysteries, setBusy, setError]);
  const createMysteryFromPicker = React.useCallback(async () => {
    if (!mysteryAdminCreateTitle.trim()) return;
    setBusy(true);
    try {
      await ApiClient.post("/api/mystery/admin.php?action=save_mystery", {
        id: 0,
        title: mysteryAdminCreateTitle,
        slug: mysteryAdminCreateSlug,
      });
      setMysteryAdminCreateTitle("");
      setMysteryAdminCreateSlug("");
      await loadMysteries();
    } catch (err: any) {
      setError(err?.message || "Failed to create mystery");
    } finally {
      setBusy(false);
    }
  }, [mysteryAdminCreateTitle, mysteryAdminCreateSlug, loadMysteries, setBusy, setError]);
  const saveMysteryFromPicker = React.useCallback(async () => {
    const mid = Number(mysteryPickerSelectedId);
    if (!mid) return;
    setBusy(true);
    try {
      await ApiClient.post("/api/mystery/admin.php?action=save_mystery", {
        id: mid,
        title: mysteryAdminEditTitle,
        slug: mysteryAdminEditSlug,
        is_archived: mysteryAdminEditArchived ? 1 : 0,
      });
      await loadMysteries();
    } catch (err: any) {
      setError(err?.message || "Failed to save mystery");
    } finally {
      setBusy(false);
    }
  }, [mysteryPickerSelectedId, mysteryAdminEditTitle, mysteryAdminEditSlug, mysteryAdminEditArchived, loadMysteries, setBusy, setError]);
  const deleteMysteryFromPicker = React.useCallback(async () => {
    const mid = Number(mysteryPickerSelectedId);
    if (!mid || !mysteryAdminDeleteArmed) return;
    setBusy(true);
    try {
      await ApiClient.post("/api/mystery/admin.php?action=delete_mystery", { id: mid });
      setMysteryPickerSelectedId("");
      setMysteryAdminDeleteArmed(false);
      await loadMysteries();
    } catch (err: any) {
      setError(err?.message || "Failed to delete mystery");
    } finally {
      setBusy(false);
    }
  }, [mysteryPickerSelectedId, mysteryAdminDeleteArmed, loadMysteries, setBusy, setError]);
  const confirmMysterySelection = React.useCallback((id?: string) => {
    const targetId = id || mysteryPickerSelectedId;
    if (!targetId) {
      return;
    }
    if (targetId !== mysteryId) {
      setCaseId("");
      catn8LocalStorageSet("catn8_case_id", "");
    }
    setMysteryId(targetId);
    const m = mysteries.find(x => String(x.id) === targetId);
    if (m) {
      setCachedMysteryTitle(m.title);
      catn8LocalStorageSet("catn8_mystery_title", m.title);
    }
    catn8LocalStorageSet("catn8_mystery_id", targetId);
  }, [mysteryPickerSelectedId, mysteryId, mysteries, setMysteryId, setCaseId, setCachedMysteryTitle]);
  React.useEffect(() => {
    const m = mysteries.find(x => String(x.id) === mysteryPickerSelectedId);
    if (m) {
      setMysteryAdminEditTitle(m.title || "");
      setMysteryAdminEditSlug(m.slug || "");
      setMysteryAdminEditArchived(Boolean(Number(m.is_archived || 0) === 1));
    } else {
      setMysteryAdminEditTitle("");
      setMysteryAdminEditSlug("");
      setMysteryAdminEditArchived(false);
    }
    setMysteryAdminDeleteArmed(false);
  }, [mysteryPickerSelectedId, mysteries]);
  const selectedMystery = React.useMemo(() => {
    if (!mysteryId || !Array.isArray(mysteries)) return null;
    return mysteries.find(m => String(m.id) === String(mysteryId)) || null;
  }, [mysteries, mysteryId]);
  const selectedCase = React.useMemo(() => {
    if (!caseId || !Array.isArray(cases)) return null;
    return cases.find(c => String(c.id) === String(caseId)) || null;
  }, [cases, caseId]);
  return { mysteries, setMysteries, mysteryId, setMysteryId, cachedMysteryTitle, setCachedMysteryTitle, selectedMystery, selectedCase, mysteryPickerList, setMysteryPickerList, mysteryPickerSelectedId, setMysteryPickerSelectedId, mysteryPickerAdminOpen, setMysteryPickerAdminOpen, mysteryAdminCreateTitle, setMysteryAdminCreateTitle, mysteryAdminCreateSlug, setMysteryAdminCreateSlug, mysteryAdminEditTitle, setMysteryAdminEditTitle, mysteryAdminEditSlug, setMysteryAdminEditSlug, mysteryAdminEditArchived, setMysteryAdminEditArchived, mysteryAdminDeleteArmed, setMysteryAdminDeleteArmed, cases, setCases, caseId, setCaseId, jobs, setJobs, scenarios, setScenarios, scenarioId, setScenarioId, scenario, setScenario, backstories, setBackstories, backstoryId, setBackstoryId, backstoryDetails, setBackstoryDetails, loadMysteries, loadCases, loadJobs, loadScenarios, loadBackstories, loadBackstoryDetails, loadBackstoryFullStory, toggleBackstoryArchived, importDefaultMystery, createMysteryFromPicker, saveMysteryFromPicker, deleteMysteryFromPicker, confirmMysterySelection };
}
