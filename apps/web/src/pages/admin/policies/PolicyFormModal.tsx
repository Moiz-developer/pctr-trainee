import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPolicyRequestSchema,
  type AdminPolicyResponse,
  type CreatePolicyRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField } from "../../../components/ui/FormField";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { createPolicy, updatePolicy } from "../../../services/api/adminPolicies";

/**
 * Create/edit a policy's own metadata — title/slug/category/description
 * (SYSTEM_PLAN.md §14.8/§23, Phase 5.2, permission `policy.manage`).
 * Mirrors CourseCategoryFormModal.tsx/ResourceCategoryFormModal.tsx's exact
 * shape. Versions (the actual content/document, effective date, activation)
 * are managed separately on AdminPolicyDetailPage.tsx — a policy's own
 * metadata and its version history are edited in two different places,
 * mirroring how a Course's own fields and its modules/lessons are edited in
 * two different places.
 */
export function PolicyFormModal({
  open,
  onClose,
  policy,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  policy?: AdminPolicyResponse;
  onSuccess: (policy: AdminPolicyResponse) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEdit = !!policy;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreatePolicyRequest>({
    resolver: zodResolver(createPolicyRequestSchema),
    defaultValues: { title: "", slug: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      policy
        ? {
            title: policy.title,
            slug: policy.slug,
            category: policy.category ?? "",
            description: policy.description ?? "",
          }
        : { title: "", slug: "" },
    );
  }, [open, policy, reset]);

  const mutation = useMutation({
    mutationFn: async (values: CreatePolicyRequest) => {
      const normalized = {
        ...values,
        category: values.category || null,
        description: values.description || null,
      };
      return isEdit ? updatePolicy(policy!.id, normalized) : createPolicy(normalized);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-policies"] });
      toast.success(isEdit ? "Policy updated." : "Policy created.");
      onSuccess(result);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof CreatePolicyRequest, { message: messages[0] });
        }
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save the policy.");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Policy" : "New Policy"}>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <TextField label="Title" id="p-title" error={errors.title?.message} {...register("title")} />
        <TextField
          label="Slug"
          id="p-slug"
          error={errors.slug?.message}
          {...register("slug")}
          placeholder="e.g. attendance-policy"
        />
        <TextField
          label="Category"
          id="p-category"
          error={errors.category?.message}
          {...register("category")}
          placeholder="Optional"
        />
        <TextAreaField
          label="Description"
          id="p-description"
          error={errors.description?.message}
          {...register("description")}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create policy"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
