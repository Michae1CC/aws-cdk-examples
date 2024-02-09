import { useEffect } from "react";

export default function Route() {
  useEffect(() => {
    document.cookie = "test1=Hi; SameSite=strict; Secure";
    window.location.href = "/";
  }, []);
}
