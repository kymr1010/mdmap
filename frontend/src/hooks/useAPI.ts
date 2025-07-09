export const fetchAPI = async (url: string, options: RequestInit) => {
  console.log(url);
  const res = await fetch(`http://localhost:8082/${url}`, options);
  const text = await res.text();

  if (!res.ok) {
    console.error("fetch error:", {
      status: res.status,
      statusText: res.statusText,
      body: text,
    });
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    throw new Error(
      `Failed to fetch ${url}, status: ${res.status} ${res.statusText}\n` +
        `Response body: ${JSON.stringify(body, null, 2)}`
    );
  }

  // 成功時は JSON パースして返却
  try {
    return JSON.parse(text);
  } catch {
    // JSON でない場合はそのまま文字列を返す
    return text;
  }
};
