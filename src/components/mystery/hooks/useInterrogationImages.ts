import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import { IAgentImagesResponse } from '../../../types/game';

export function useInterrogationImages(interrogationAgentId: number) {
  const [interrogationIrUrls, setInterrogationIrUrls] = React.useState<string[]>([]);
  const [interrogationIrIndex, setInterrogationIrIndex] = React.useState(0);

  React.useEffect(() => {
    const aid = Number(interrogationAgentId || 0);
    console.log(`[useInterrogationImages] interrogationAgentId changed: ${aid}`);
    // Allow agent IDs up to 100 (Sheriff)
    if (!(aid >= 1 && aid <= 100)) {
      console.log(`[useInterrogationImages] Invalid agent ID: ${aid}, resetting URLs`);
      setInterrogationIrUrls([]);
      setInterrogationIrIndex(0);
      return;
    }
    let stopped = false;
    (async () => {
      try {
        console.log(`[useInterrogationImages] Fetching images for agent ${aid}...`);
        // Use the newly registered list_agent_images action
        const res = await ApiClient.get<IAgentImagesResponse>('/api/mystery/admin.php?action=list_agent_images&agent_id=' + String(aid));
        console.log(`[useInterrogationImages] API response for agent ${aid}:`, res);
        if (stopped) return;
        if (res && res.success === true) {
          const urls = Array.isArray(res.ir_urls) ? res.ir_urls.map((x) => String(x || '')).filter(Boolean) : [];
          console.log(`[useInterrogationImages] Found ${urls.length} IR URLs for agent ${aid}:`, urls);
          setInterrogationIrUrls(urls);
          setInterrogationIrIndex(0);
          return;
        }
      } catch (_e) {
        console.error(`[useInterrogationImages] Failed to fetch images for agent ${aid}:`, _e);
      }
      if (stopped) return;
      setInterrogationIrUrls([]);
      setInterrogationIrIndex(0);
    })();
    return () => { stopped = true; };
  }, [interrogationAgentId]);

  React.useEffect(() => {
    const urls = Array.isArray(interrogationIrUrls) ? interrogationIrUrls : [];
    if (urls.length <= 1) return;
    const timer = window.setInterval(() => {
      setInterrogationIrIndex((prev) => (prev + 1) % urls.length);
    }, 8000);
    return () => { try { window.clearInterval(timer); } catch (_e) {} };
  }, [interrogationIrUrls]);

  const interrogationImageUrlFinal = React.useMemo(() => {
    const aid = Number(interrogationAgentId || 0);
    const urls = Array.isArray(interrogationIrUrls) ? interrogationIrUrls : [];
    
    // 1. If we have dynamic URLs from the API, use them
    if (urls.length > 0) {
      const idx = Math.max(0, Math.min(interrogationIrIndex, urls.length - 1));
      return urls[idx];
    }
    
    // 2. Fallback to the _angry convention if it exists for this agent
    if (aid >= 1 && aid <= 100) {
      return `/images/mystery/agent${aid}_ir_angry.png`;
    }
    
    // 3. Absolute fallback
    return '/images/mystery/interrogation_room_empty.png';
  }, [interrogationAgentId, interrogationIrIndex, interrogationIrUrls]);

  return React.useMemo(() => ({ interrogationImageUrlFinal }), [interrogationImageUrlFinal]);
}
