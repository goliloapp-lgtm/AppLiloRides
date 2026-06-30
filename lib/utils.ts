export const sortRides = (rides: any[]) => {
  const result = rides.sort((a, b) => {
    const dateA = new Date(`${a.created_at}T${a.ride_time}`);
    const dateB = new Date(`${b.created_at}T${b.ride_time}`);
    return dateB.getTime() - dateA.getTime();
  });

  return result.reverse();
};

export function formatTime(minutes: number): string {
  const formattedMinutes = +minutes?.toFixed?.(0) || 0;

  if (formattedMinutes < 60) {
    return `${minutes} min`;
  } else {
    const hours = Math.floor(formattedMinutes / 60);
    const remainingMinutes = formattedMinutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${day < 10 ? "0" + day : day} ${month} ${year}`;
}

// Genera un ID simple (no crípticamente único, suficiente para RTDB push local)
export function generateId(prefix = "id"): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`;
}

export const fetchAPI = async (
  path: string, 
  options: RequestInit = {}, 
  retries = 3, 
  backoffMs = 1000
): Promise<any> => {
  const baseURL = "https://app-passenger-seven.vercel.app";
  const normalized = path.startsWith("https://") || path.startsWith("http://")
    ? path
    : path.replace(/^\.\//, "/");
  const url = `${baseURL}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
  console.log("Fetching URL:", url); // Debug log

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const text = await res.text();
        // Do not retry common client-side errors (400-499) except timeout (408) and rate limits (429)
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          throw new Error(`Request failed ${res.status}: ${text}`);
        }
        throw new Error(`Request failed ${res.status}: ${text}`);
      }
      return await res.json();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      const delay = backoffMs * Math.pow(2, attempt - 1);
      console.warn(`[API] Fetch attempt ${attempt} failed. Retrying in ${delay}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};
