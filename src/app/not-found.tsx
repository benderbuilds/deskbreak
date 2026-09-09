import { ButtonLink } from "@/components/Button";
import { ErrorState } from "@/components/StatusStates";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-5">
      <ErrorState
        title="That page took a break"
        body="It isn’t in DeskBreak. Head home and pick a reset."
        action={<ButtonLink href="/">Back home</ButtonLink>}
      />
    </div>
  );
}
