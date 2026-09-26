/* ------------------------------------------------------------------ */
/*  Vigie — Ce que la synchro ne tranche pas seule                      */
/* ------------------------------------------------------------------ */

/*
 * Deux cas où une correction détruirait quelque chose, laissés à
 * l'administrateur : un compte supprimé de Jellyfin qui a encore des
 * demandes en cours (l'oublier), et un compte Jellyseerr sans compte Jellyfin
 * (le supprimer — Jellyseerr efface ses demandes avec lui). Chaque geste
 * passe par une confirmation qui dit ce qu'il emporte.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { UsersOverview } from "../../../api/types";
import { useDeleteSeerrUser, useForgetAdminUser } from "../../../hooks/useAdminUsers";
import { useToast } from "../../../hooks/useToast";
import { formatSeerError } from "../../../api/seer-client";
import { CTA_DANGER, CTA_SECONDARY, CTA_SIZE_SM } from "../../../styles/cta";
import { AlertIcon } from "../../ui/icons";
import { Card, Chip } from "../adminKit";
import { ConfirmSheet } from "../ConfirmSheet";
import { UserAvatar } from "./UserAvatar";

type Pending =
  | { kind: "forget"; id: string; name: string }
  | { kind: "delete"; seerrId: number; name: string };

function Row({ id, name, meta, chips, action }: {
  id: string; name: string; meta: string; chips?: React.ReactNode; action: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <UserAvatar userId={id} name={name} imageTag={null} size={36} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-tentacle-text-primary">
          <span className="truncate">{name}</span>
          {chips}
        </p>
        <p className="mt-0.5 text-[13px] text-tentacle-text-tertiary">{meta}</p>
      </div>
      {action}
    </li>
  );
}

export function AttentionPanel({ overview }: { overview: UsersOverview }) {
  const { t } = useTranslation("seer");
  const toast = useToast();
  const forget = useForgetAdminUser();
  const remove = useDeleteSeerrUser();
  const [pending, setPending] = useState<Pending | null>(null);
  const { gone, orphanSeerr } = overview.attention;
  if (gone.length === 0 && orphanSeerr.length === 0) return null;

  const confirm = () => {
    if (!pending) return;
    const onError = (err: unknown) => toast.show("error", t("seer:admActionFailed", { error: formatSeerError(err, t) }));
    if (pending.kind === "forget") {
      forget.mutate(pending.id, {
        onSuccess: () => { toast.show("success", t("seer:admForgotten", { name: pending.name })); setPending(null); },
        onError,
      });
    } else {
      remove.mutate(pending.seerrId, {
        onSuccess: () => { toast.show("success", t("seer:admDeletedSeerr", { name: pending.name })); setPending(null); },
        onError,
      });
    }
  };

  return (
    <Card
      title={t("seer:admAttentionTitle")}
      action={<AlertIcon className="h-5 w-5 text-tentacle-status-warning-fg" />}
    >
      {gone.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-tentacle-text-primary">{t("seer:admGoneTitle")}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-tentacle-text-tertiary">{t("seer:admGoneDesc")}</p>
          <ul className="mt-1 divide-y divide-tentacle-border-subtle">
            {gone.map((g) => (
              <Row
                key={g.jellyfinUserId}
                id={g.jellyfinUserId}
                name={g.username}
                meta={t("seer:admGoneRequests", { count: g.activeRequests })}
                chips={g.seerr ? <Chip>{t("seer:admLinkLinked", { name: g.seerr.name })}</Chip> : null}
                action={(
                  <div className="flex gap-2">
                    <button type="button" className={`${CTA_SECONDARY} ${CTA_SIZE_SM}`}
                      onClick={() => setPending({ kind: "forget", id: g.jellyfinUserId, name: g.username })}>
                      {t("seer:admForget")}
                    </button>
                    {g.seerr && (
                      <button type="button" className={`${CTA_DANGER} ${CTA_SIZE_SM}`}
                        onClick={() => setPending({ kind: "delete", seerrId: g.seerr!.id, name: g.seerr!.name })}>
                        {t("seer:admDeleteSeerr")}
                      </button>
                    )}
                  </div>
                )}
              />
            ))}
          </ul>
        </section>
      )}

      {orphanSeerr.length > 0 && (
        <section className={gone.length > 0 ? "mt-5 border-t border-tentacle-border-subtle pt-4" : ""}>
          <h3 className="text-sm font-semibold text-tentacle-text-primary">{t("seer:admOrphansTitle")}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-tentacle-text-tertiary">{t("seer:admOrphansDesc")}</p>
          <ul className="mt-1 divide-y divide-tentacle-border-subtle">
            {orphanSeerr.map((o) => (
              <Row
                key={o.id}
                id={`seerr-${o.id}`}
                name={o.name}
                meta={[o.email, o.requestCount !== null ? t("seer:admOrphanRequests", { count: o.requestCount }) : null]
                  .filter(Boolean).join(" · ")}
                chips={o.placeholder ? <Chip tone="info">{t("seer:admOrphanPlaceholder")}</Chip> : null}
                action={(
                  <button type="button" className={`${CTA_DANGER} ${CTA_SIZE_SM}`}
                    onClick={() => setPending({ kind: "delete", seerrId: o.id, name: o.name })}>
                    {t("seer:admDeleteSeerr")}
                  </button>
                )}
              />
            ))}
          </ul>
        </section>
      )}

      <ConfirmSheet
        open={pending !== null}
        danger={pending?.kind === "delete"}
        title={pending?.kind === "delete"
          ? t("seer:admDeleteSeerrConfirmTitle", { name: pending.name })
          : t("seer:admForgetConfirmTitle", { name: pending?.name ?? "" })}
        body={pending?.kind === "delete" ? t("seer:admDeleteSeerrConfirmBody") : t("seer:admForgetConfirmBody")}
        confirmLabel={pending?.kind === "delete" ? t("seer:admDeleteSeerr") : t("seer:admForget")}
        busy={forget.isPending || remove.isPending}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </Card>
  );
}
