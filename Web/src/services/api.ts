interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

const getApiBaseUrl = (): string => {
  // Проверяем localStorage для переопределения URL
  const savedUrl = localStorage.getItem("REACT_APP_API_URL");
  return savedUrl || process.env.REACT_APP_API_URL || "http://localhost:6001";
};

/* Единый класс, через который в компонентах будет вызываться любая функция api сервиса */
class ApiService {
  /* Основной переиспользуемый другими запросами ниже запрос */
  static async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${getApiBaseUrl()}/api/${endpoint}`;

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  /* Запросы получения данных */
  static async get<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  /* Запросы обновления данных */
  static async put<T = unknown>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  static async getAllAcccounts<T = unknown>(): Promise<T> {
    return this.get<T>("accaunts-all");
  }
}

export default ApiService;
