/**
 * Example user script — runs on Cloudflare Worker.
 * exports.execute(ctx, hook) with fetch (no axios).
 */

exports.execute = async (ctx, hook) => {
  // ctx.formData.$formId.$formInputKey -> Read form input from different forms
  // ctx.store.get("x") / hook.setStoreData("x","value") -> custom store
  // ctx.forms -> array of all forms with datatypes, input name, placeholder
  // ctx.session_id -> form session id

  try {
    const email = ctx.formData["form_1"]?.email;
    const resp = await fetch(
      `https://api.example.com/user-data?email=${encodeURIComponent(email)}`,
      { method: "GET" }
    );
    const data = await resp.json();

    if (data.isAdmin) {
      await hook.setStoreData("role", "admin");
    }
  } catch (error) {
    const message = error?.message ?? String(error);
    hook.log("error", "Error fetching user data: " + message);
    hook.setError(500, "Internal Server Error", "Failed to fetch user data.");
  }
};
