"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { pushPreferences } from "@/lib/account-client";
import { track } from "@/lib/analytics";
import { isExerciseLocked } from "@/lib/entitlements";
import { toggleFavorite } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { Exercise } from "@/lib/types";

/** "Do now" and "Favorite" for one movement. */
export function ExerciseActions({ exercise, inApp }: { exercise: Exercise; inApp: boolean }) {
  const router = useRouter();
  const isClient = useIsClient();
  const state = useAppState();
  const locked = isClient && isExerciseLocked(exercise, state.entitlement);
  const favorite = isClient && state.favorites.includes(exercise.id);

  function doNow() {
    if (locked) {
      track("locked_program_clicked", { exercise_id: exercise.id, source: "exercise_detail" });
      router.push(`/app/pro?from=exercise&need=${exercise.needs[0]}`);
      return;
    }
    router.push(`/app/start?need=${exercise.needs[0]}&source=${inApp ? "explore" : "seo"}`);
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <Button block={false} size="sm" onClick={doNow}>
        {locked ? "Included in Pro" : "Do now"}
      </Button>
      {isClient ? (
        <Button
          block={false}
          size="sm"
          variant="secondary"
          aria-pressed={favorite}
          onClick={() => {
            const added = toggleFavorite(exercise.id);
            track(added ? "favorite_added" : "favorite_removed", { exercise_id: exercise.id });
            void pushPreferences();
          }}
        >
          {favorite ? "Favorited" : "Favorite"}
        </Button>
      ) : null}
    </div>
  );
}
