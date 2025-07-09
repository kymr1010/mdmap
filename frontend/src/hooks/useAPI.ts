export const fetchAPI = async (url: string, options: RequestInit) => {
  const res = await fetch(`http://localhost:8082/${url}`, options);
  console.log(res);
  if (!res.ok) {
    console.error(res);
    throw new Error(res.statusText);
  }
  return res.json();
};
