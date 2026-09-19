import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { searchUsers } from "../../../services/api/users";
import { grantCourseAccess } from "../../../services/api/courseAccess";

/** Dynamic user picker (SYSTEM_PLAN.md rule §6 of this unit — never a hardcoded user list). */
export function GrantAccessModal({
  open,
  onClose,
  courseId,
  alreadyGrantedUserIds,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  alreadyGrantedUserIds: Set<string>;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [submittedTerm, setSubmittedTerm] = useState("");

  const query = useQuery({
    queryKey: ["user-search", submittedTerm],
    queryFn: () => searchUsers(submittedTerm),
    enabled: open,
  });

  const grant = useMutation({
    mutationFn: (userId: string) => grantCourseAccess(courseId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-access", courseId] });
      toast.success("Access granted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to grant access.");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Grant Course Access">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedTerm(term);
        }}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search by name, employee ID, or email…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="mt-4 max-h-72 overflow-y-auto">
        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data}
          isEmpty={(items) => items.length === 0}
          emptyTitle={submittedTerm ? "No matching users" : "Search for a user above"}
        >
          {(users) => (
            <ul className="divide-y divide-slate-100">
              {users.map((user) => {
                const alreadyGranted = alreadyGrantedUserIds.has(user.id);
                return (
                  <li key={user.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {user.full_name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {user.employee_id} · {user.email}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 gap-1 px-3 py-1.5 text-xs"
                      disabled={alreadyGranted || (grant.isPending && grant.variables === user.id)}
                      onClick={() => grant.mutate(user.id)}
                    >
                      <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      {alreadyGranted ? "Already granted" : "Grant"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </RemoteDataView>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
