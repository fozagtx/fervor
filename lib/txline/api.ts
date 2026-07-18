import { API_BASE } from "./config";
import { getAuth, renewJwt } from "./auth";

/** Authenticated GET against the TxLINE off-chain API with one 401 retry. */
export async function txGet<T>(pathAndQuery: string): Promise<T> {
  const { jwt, apiToken } = await getAuth();

  const doFetch = (token: string) =>
    fetch(`${API_BASE}${pathAndQuery}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Api-Token": apiToken,
      },
      cache: "no-store",
    });

  let res = await doFetch(jwt);
  if (res.status === 401) {
    const fresh = await renewJwt();
    res = await doFetch(fresh);
  }
  if (!res.ok) {
    throw new Error(`GET ${pathAndQuery} → ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}
