# Deploy to Render

## Free preview

To try the website without a paid service, select branch `website-launch` and Blueprint Path `render-free.yaml`. It specifies the free plan with no paid disk. Review Render's summary before deploying; do not approve a paid resource for this option. The site shows a preview notice and disables payment links. Use test details only: records may be lost when the free service restarts or redeploys, and the service may sleep when idle. This is not the production setup for recruiting real applicants.

## Persistent production setup

The included Blueprint (`render.yaml`) deploys the website and API together with persistent storage for applications and interest lists. **This configuration uses a paid Starter web service and a persistent disk. Review Render's displayed price before creating resources.** A free service without persistent storage is not suitable for collecting real applications because records can be lost on redeployment or restart.

1. In Render, connect GitHub and grant access to `mik-nahtan/Startup-veteRAN`.
2. Choose **New → Blueprint**, select this repository and the branch containing the website (`website-launch`), and use `render.yaml`.
3. Review the service, disk, and current price. Deploy only if you accept that cost.
4. Wait for a successful build and healthy service. Open the public address Render supplies. Check that the hero image and event list load.
5. Submit an application you control. Open `/organizer` on the public address, then sign in using the generated `ADMIN_TOKEN` from Render's environment settings. Keep that token private; do not paste it into chat. Verify the application is listed, then remove the test submission using its email and reference in **Privacy & your data**.
6. Set `PUBLIC_CONTACT_EMAIL` in Render to a real monitored project address. Configure database backups and check that records persist after a restart before inviting participants.

Donations remain interest-only, proposed events are not confirmed registrations, and email delivery is not connected. Do not set `DONATION_URL` or `DONATION_PARTNER_NAME` until the receiving organization approves the campaign. Automatic deployment is disabled; deploy future reviewed changes manually.

Creating a cloud development environment snapshot does not deploy this website. Only Render's successful deployment establishes a public address.
