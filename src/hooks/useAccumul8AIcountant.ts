import React from 'react';

import { ApiClient } from '../core/ApiClient';
import {
  Accumul8AIcountantConversation,
  Accumul8AIcountantConversationResponse,
  Accumul8AIcountantListResponse,
  Accumul8AIcountantMessage,
} from '../types/accumul8';

type ToastPayload = {
  tone: 'success' | 'error' | 'info' | 'warning';
  message: string;
};

export function useAccumul8AIcountant(
  ownerUserId?: number | null,
  onToast?: (payload: ToastPayload) => void,
) {
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [conversations, setConversations] = React.useState<Accumul8AIcountantConversation[]>([]);
  const [activeConversation, setActiveConversation] = React.useState<Accumul8AIcountantConversation | null>(null);
  const [messages, setMessages] = React.useState<Accumul8AIcountantMessage[]>([]);
  const [defaultSystemPrompt, setDefaultSystemPrompt] = React.useState('');
  const [suggestedStarters, setSuggestedStarters] = React.useState<string[]>([]);

  const scopedActionUrl = React.useCallback((action: string, extraParams?: Record<string, string | number>) => {
    const params = new URLSearchParams({ action });
    if (ownerUserId && ownerUserId > 0) {
      params.set('owner_user_id', String(ownerUserId));
    }
    Object.entries(extraParams || {}).forEach(([key, value]) => {
      params.set(key, String(value));
    });
    return `/api/accumul8.php?${params.toString()}`;
  }, [ownerUserId]);

  React.useEffect(() => {
    setActiveConversation(null);
    setMessages([]);
  }, [ownerUserId]);

  const applyConversationPayload = React.useCallback((payload: Accumul8AIcountantConversationResponse) => {
    setActiveConversation(payload.conversation || null);
    setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    setConversations((current) => {
      const next = Array.isArray(current) ? [...current] : [];
      const index = next.findIndex((conversation) => conversation.id === payload.conversation.id);
      if (index >= 0) {
        next[index] = payload.conversation;
      } else {
        next.unshift(payload.conversation);
      }
      return next
        .slice()
        .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || b.id - a.id);
    });
  }, []);

  const loadConversations = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await ApiClient.get<Accumul8AIcountantListResponse>(scopedActionUrl('list_aicountant_conversations'));
      const nextConversations = Array.isArray(response?.conversations) ? response.conversations : [];
      setConversations(nextConversations);
      setDefaultSystemPrompt(String(response?.default_system_prompt || ''));
      setSuggestedStarters(
        Array.isArray(response?.suggested_starters)
          ? response.suggested_starters.map((starter) => String(starter || '')).filter(Boolean)
          : [],
      );

      setActiveConversation((current) => {
        if (!current) {
          return null;
        }
        const refreshed = nextConversations.find((conversation) => conversation.id === current.id);
        return refreshed || null;
      });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to load AIcountant conversations') });
    } finally {
      setLoading(false);
    }
  }, [onToast, scopedActionUrl]);

  const openConversation = React.useCallback(async (conversationId: number) => {
    if (!conversationId || conversationId <= 0) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const response = await ApiClient.get<Accumul8AIcountantConversationResponse>(
        scopedActionUrl('get_aicountant_conversation', { id: conversationId }),
      );
      applyConversationPayload(response);
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to load conversation') });
    } finally {
      setLoading(false);
    }
  }, [applyConversationPayload, onToast, scopedActionUrl]);

  const createConversation = React.useCallback(async (title = '') => {
    setLoading(true);
    try {
      const response = await ApiClient.post<Accumul8AIcountantConversationResponse>(
        scopedActionUrl('create_aicountant_conversation'),
        { title },
      );
      applyConversationPayload(response);
      return response;
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to create conversation') });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [applyConversationPayload, onToast, scopedActionUrl]);

  const renameConversation = React.useCallback(async (conversationId: number, title: string) => {
    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) {
      onToast?.({ tone: 'warning', message: 'Conversation title cannot be empty.' });
      return;
    }
    setLoading(true);
    try {
      const response = await ApiClient.post<Accumul8AIcountantConversationResponse>(
        scopedActionUrl('rename_aicountant_conversation'),
        { id: conversationId, title: normalizedTitle },
      );
      applyConversationPayload(response);
      onToast?.({ tone: 'success', message: 'Conversation title updated.' });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to rename conversation') });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [applyConversationPayload, onToast, scopedActionUrl]);

  const deleteConversation = React.useCallback(async (conversationId: number) => {
    setLoading(true);
    try {
      await ApiClient.post(scopedActionUrl('delete_aicountant_conversation'), { id: conversationId });
      setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
      setActiveConversation((current) => (current?.id === conversationId ? null : current));
      setMessages((current) => (activeConversation?.id === conversationId ? [] : current));
      onToast?.({ tone: 'success', message: 'Conversation deleted.' });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to delete conversation') });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [activeConversation?.id, onToast, scopedActionUrl]);

  const sendMessage = React.useCallback(async (message: string, conversationId?: number | null) => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) {
      return null;
    }
    setSending(true);
    try {
      const response = await ApiClient.post<Accumul8AIcountantConversationResponse>(
        scopedActionUrl('send_aicountant_message'),
        {
          conversation_id: conversationId || activeConversation?.id || null,
          message: normalizedMessage,
        },
      );
      applyConversationPayload(response);
      return response;
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to send message to AIcountant') });
      throw error;
    } finally {
      setSending(false);
    }
  }, [activeConversation?.id, applyConversationPayload, onToast, scopedActionUrl]);

  React.useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  return {
    loading,
    sending,
    conversations,
    activeConversation,
    messages,
    defaultSystemPrompt,
    suggestedStarters,
    loadConversations,
    openConversation,
    createConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
  };
}
