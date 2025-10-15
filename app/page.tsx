import { useEffect } from "react";

useEffect(() => {
  // erster Seitenaufruf
  fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "visit" }),
  });
}, []);
