import React, { useCallback, useState } from "react";
import { Input } from "./ui/input";
import { useStableCallback } from "@/app/hooks/useStableCallback";

type ChatProps = {
  onMsg: (msg: string) => unknown;
  msgs: { nonce: number; msg: string }[];
};

const Chat = React.memo(function (props: ChatProps) {
  const { onMsg, msgs } = props;
  const [msg, setMsg] = useState("");

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMsg(e.target.value);
  }, []);

  const handleSubmit = useStableCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onMsg(msg);
      setMsg("");
    },
    [msg, onMsg]
  );

  return (
    <div>
      <ul>
        {msgs.map(({ nonce, msg }) => (
          <li key={nonce}>{msg}</li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <Input value={msg} onChange={handleChange} />
      </form>
    </div>
  );
});

Chat.displayName = "Chat";

export default Chat;
