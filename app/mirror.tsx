
async function broadcast(payload: MirrorState) {
  if (!client) return;

  const channel = client.channel(`mirror-${room}`, {
    config: { broadcast: { self: true } }
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Supabase connection timed out"));
      }, 10000);

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          clearTimeout(timeout);
          reject(new Error(`Supabase channel status: ${status}`));
        }
      });
    });

    await channel.send({
      type: "broadcast",
      event: "state",
      payload
    });

    setStatus(`Live • room /${room}`);
  } catch (error) {
    console.error("Broadcast failed:", error);
    setStatus("Live sync failed. Check Supabase settings.");
  } finally {
    await client.removeChannel(channel);
  }
}
