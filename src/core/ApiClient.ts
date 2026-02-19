export class ApiClient {
  static csrfToken = null;
  static csrfPromise = null;
  static clientVersion = 'ApiClientSnapshotBody-v1';

  static async getCsrfToken() {
    if (ApiClient.csrfToken) return ApiClient.csrfToken;
    if (ApiClient.csrfPromise) return ApiClient.csrfPromise;

    ApiClient.csrfPromise = (async () => {
      const headers = { Accept: 'application/json' };
      const res = await fetch('/api/auth/csrf.php', { method: 'GET', headers, credentials: 'same-origin' });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (_) {
        json = null;
      }
      if (!res.ok) {
        const msg = (json && json.error) ? json.error : `Request failed: ${res.status}`;
        throw new Error(msg);
      }
      const token = json && typeof json.csrf === 'string' ? json.csrf : '';
      if (!token) {
        throw new Error('Failed to fetch CSRF token');
      }
      ApiClient.csrfToken = token;
      return token;
    })().finally(() => {
      ApiClient.csrfPromise = null;
    });

    return ApiClient.csrfPromise;
  }

  static async request<T = any>(method: string, url: string, body?: any): Promise<T> {
    const isMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    const opts: RequestInit = {
      method,
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin' as RequestCredentials,
    };

    let bodyJson = null;
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      bodyJson = JSON.stringify(body);
      opts.headers['X-CATN8-CLIENT'] = ApiClient.clientVersion;
      opts.headers['X-CATN8-CLIENT-PAYLOAD-LEN'] = String(bodyJson.length);
    }

    try {
      if (isMutation) {
        opts.headers['X-CATN8-CSRF'] = await ApiClient.getCsrfToken();
      }
    } catch (err) {
      console.error('[ApiClient] CSRF failure:', err);
      // Continue anyway, server might not require it for this endpoint
    }

    if (bodyJson !== null) {
      opts.body = bodyJson;
    }

    let res;
    try {
      res = await fetch(url, opts);
    } catch (err) {
      console.error(`[ApiClient] Fetch request failed for ${method} ${url}:`, err);
      throw err;
    }
    const text = await res.text();

    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }

    if (!res.ok) {
      if (isMutation && res.status === 403 && json && json.error === 'Invalid CSRF token') {
        ApiClient.csrfToken = null;
        opts.headers['X-CATN8-CSRF'] = await ApiClient.getCsrfToken();
        const retryRes = await fetch(url, opts);
        const retryText = await retryRes.text();
        let retryJson = null;
        try {
          retryJson = retryText ? JSON.parse(retryText) : null;
        } catch (_) {
          retryJson = null;
        }
        if (!retryRes.ok) {
          const msg = (retryJson && retryJson.error) ? retryJson.error : `Request failed: ${retryRes.status}`;
          const err: any = new Error(msg);
          err.status = retryRes.status;
          err.payload = retryJson;
          throw err;
        }
        return retryJson;
      }

      const msg = (json && json.error) ? json.error : `Request failed: ${res.status}`;
      const err: any = new Error(msg);
      err.status = res.status;
      err.payload = json;
      throw err;
    }

    return json;
  }

  static get<T = any>(url: string): Promise<T> {
    return ApiClient.request<T>('GET', url, undefined);
  }

  static post<T = any>(url: string, body?: any): Promise<T> {
    return ApiClient.request<T>('POST', url, body);
  }

  static async postFormData<T = any>(url: string, formData: FormData): Promise<T> {
    const opts: RequestInit = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin' as RequestCredentials,
      body: formData,
    };

    opts.headers['X-CATN8-CSRF'] = await ApiClient.getCsrfToken();

    let res;
    try {
      res = await fetch(url, opts);
    } catch (err) {
      console.error(`[ApiClient] postFormData fetch failed for ${url}:`, err);
      throw err;
    }
    const text = await res.text();

    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }

    if (!res.ok) {
      if (res.status === 403 && json && json.error === 'Invalid CSRF token') {
        ApiClient.csrfToken = null;
        opts.headers['X-CATN8-CSRF'] = await ApiClient.getCsrfToken();
        res = await fetch(url, opts);
        const retryText = await res.text();
        let retryJson = null;
        try {
          retryJson = retryText ? JSON.parse(retryText) : null;
        } catch (_) {
          retryJson = null;
        }
        if (!res.ok) {
          const msg = (retryJson && retryJson.error) ? retryJson.error : `Request failed: ${res.status}`;
          const err: any = new Error(msg);
          err.status = res.status;
          err.payload = retryJson;
          throw err;
        }
        return retryJson;
      }

      const msg = (json && json.error) ? json.error : `Request failed: ${res.status}`;
      const err: any = new Error(msg);
      err.status = res.status;
      err.payload = json;
      throw err;
    }

    return json;
  }
}
