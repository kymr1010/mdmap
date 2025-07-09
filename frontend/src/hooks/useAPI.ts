export const fetchAPI = async (url: string, options: RequestInit) => {
  console.log(url);
  const res = await fetch(`http://localhost:8082/${url}`, options);
  console.log(res);
  if (!res.statusText === "OK") {
    console.error(res);
    throw new Error(res.statusText);
  }
  return res.json();
};
