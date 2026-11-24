export async function onRequestPost(context) {
  const { request, env } = context;

  const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  const apiKey = env.BUTTONDOWN_SUBSCRIBE_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Newsletter signup is temporarily unavailable." }),
      { status: 503, headers: jsonHeaders }
    );
  }

  let email = "";
  let tag = "tuesday-app-dispatch";
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      email = String(body.email || "").trim();
      if (body.tag) tag = String(body.tag).trim();
    } else {
      const form = await request.formData();
      email = String(form.get("email") || "").trim();
      if (form.get("tag")) tag = String(form.get("tag")).trim();
    }
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid request payload." }),
      { status: 400, headers: jsonHeaders }
    );
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Please enter a valid email address." }),
      { status: 400, headers: jsonHeaders }
    );
  }

  const upstream = await fetch("https://api.buttondown.com/v1/subscribers", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      tags: [tag],
      referrer_url: "https://tuesday.sh/dispatch",
    }),
  });

  if (upstream.ok) {
    return new Response(
      JSON.stringify({
        ok: true,
        message: "You're on the list! Check your inbox to confirm your Tuesday Dispatch subscription.",
      }),
      { status: 201, headers: jsonHeaders }
    );
  }

  let detail = "Could not complete subscription right now. Please try again.";
  try {
    const errBody = await upstream.json();
    const raw = JSON.stringify(errBody).toLowerCase();
    if (raw.includes("already subscribed") || raw.includes("email_already_exists")) {
      return new Response(
        JSON.stringify({
          ok: true,
          alreadySubscribed: true,
          message: "You're already subscribed to The Tuesday Dispatch!",
        }),
        { status: 200, headers: jsonHeaders }
      );
    }
    if (errBody && typeof errBody.detail === "string") {
      detail = errBody.detail;
    }
  } catch {
    // keep default error message
  }

  return new Response(
    JSON.stringify({ ok: false, error: detail }),
    { status: upstream.status >= 400 && upstream.status < 500 ? 400 : 502, headers: jsonHeaders }
  );
}
