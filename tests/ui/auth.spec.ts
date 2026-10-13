import { test, expect } from "@playwright/test";

for (const enroll of [false,true]) {
  test(`password cannot carry into ${enroll ? "enrollment" : "verification"} code input`, async ({page}) => {
    const user = {id:"auth-test",email:"auth@example.invalid",factors:enroll ? [] : [{id:"factor",factor_type:"totp",status:"verified"}]};
    function session(aal: string) {
      const claims = {sub:user.id,aal,exp:Math.floor(Date.now()/1000)+3600,amr:[{method:"password",timestamp:1}]};
      return {access_token:`e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.test`,
        refresh_token:"fake-refresh",token_type:"bearer",expires_in:3600,user};
    }
    let verifiedCode = "";
    await page.route("https://ui-fixture.supabase.co/**",async(route)=>{
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/token")) await route.fulfill({json:session("aal1")});
      else if (url.pathname.endsWith("/user")) await route.fulfill({json:user});
      else if (url.pathname.endsWith("/challenge")) await route.fulfill({json:{id:"challenge",expires_at:Math.floor(Date.now()/1000)+300}});
      else if (url.pathname.endsWith("/verify")) {
        verifiedCode = route.request().postDataJSON().code;
        await route.fulfill({json:session("aal2")});
      } else if (url.pathname.endsWith("/factors") && route.request().method()==="POST") {
        await route.fulfill({json:{id:"factor",type:"totp",totp:{qr_code:"data:image/svg+xml;utf-8,<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",secret:"FAKE-TEST-SETUP",uri:"otpauth://test"}}});
      } else await route.fulfill({status:400,json:{message:"Unexpected isolated auth request"}});
    });
    await page.goto("/login?setPassword=1");
    await page.getByLabel("E-Mail",{exact:true}).fill(user.email);
    // Numeric too, so a password/code validation mismatch cannot hide field reuse.
    await page.getByLabel("Passwort",{exact:true}).fill("135790");
    await page.getByRole("button",{name:"Anmelden",exact:true}).click();
    const code = page.getByLabel("Authenticator-Code",{exact:true});
    await expect(code).toBeVisible();
    await expect(code).toHaveValue("");
    await expect(page.locator("#auth-password")).toHaveCount(0);
    await expect(code).toHaveAttribute("autocomplete","one-time-code");
    await code.fill("secret");
    await expect(code).toHaveValue("");
    await code.fill("246801");
    await page.getByRole("button",{name:"Code bestätigen",exact:true}).click();
    await expect(page.getByLabel("Neues Passwort",{exact:true})).toHaveValue("");
    expect(verifiedCode).toBe("246801");
    await expect(page.locator("#auth-totp-code")).toHaveCount(0);
  });
}

test("signup starts a free trial without payment details", async ({page}) => {
  let body: Record<string, string> = {};
  await page.route("**/api/signup", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({json:{message:"Fast geschafft: Wir haben dir eine E-Mail gesendet."}});
  });
  await page.goto("/signup");
  await expect(page.getByText("14 Tage kostenlos testen")).toBeVisible();
  await page.getByLabel("Firma oder Name").fill("Muster GmbH");
  await page.getByLabel("Dein Name").fill("Mia Muster");
  await page.getByLabel("E-Mail",{exact:true}).fill("mia@example.invalid");
  await page.getByRole("button",{name:"Kostenlos starten"}).click();
  await expect(page.getByRole("status")).toContainText("E-Mail gesendet");
  expect(body).toEqual({company:"Muster GmbH",name:"Mia Muster",email:"mia@example.invalid"});
});
