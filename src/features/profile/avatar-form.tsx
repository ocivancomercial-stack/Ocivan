"use client";

import Image from "next/image";
import { useActionState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { initialFormState } from "@/types/forms";
import { updateAvatarAction } from "./actions";

export function AvatarForm({ name, avatar }: { name: string; avatar: string | null }) {
  const [state, action, pending] = useActionState(updateAvatarAction, initialFormState);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="relative shrink-0">
      <label className="group relative grid size-16 cursor-pointer place-items-center overflow-hidden rounded-full bg-brand text-2xl font-extrabold text-white" title="Trocar foto de perfil">
        {avatar ? <Image src={avatar} alt="Sua foto de perfil" fill sizes="64px" className="object-cover" /> : name.charAt(0).toUpperCase()}
        <span className="absolute inset-0 grid place-items-center bg-ink/50 opacity-0 transition group-hover:opacity-100">
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
        <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={() => form.current?.requestSubmit()} />
      </label>
      {state.message && <p className={`absolute left-0 top-full mt-1 w-48 text-xs ${state.ok ? "text-brand" : "text-danger"}`}>{state.message}</p>}
    </form>
  );
}
