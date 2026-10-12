import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { getCurrentServerUser } from '@/lib/auth/current-user-server';
import { getEntitlementContext } from '@/lib/auth/entitlement';
import { accessibleQuestionWhere, discussionAuthorName, discussionAuthorSelect } from '@/lib/discuss';

export const dynamic = 'force-dynamic';

export default async function DiscussPage() {
  const user = await getCurrentServerUser();
  const entitlement = user ? await getEntitlementContext(user.id) : null;

  // Threads often contain solutions: only list those on questions this viewer can open.
  const threads = await prisma.discussionThread.findMany({
    where: { status: 'ACTIVE', question: accessibleQuestionWhere(entitlement) },
    include: {
      user: discussionAuthorSelect,
      question: {
        select: {
          title: true,
          slug: true
        }
      },
      comments: true,
      likes: true
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return (
    <section className="stack-gap">
      <div>
        <h1>Discuss</h1>
        <p>Community threads around problem-solving strategies and implementation tradeoffs.</p>
      </div>
      <ul className="thread-list">
        {threads.map((thread) => (
          <li key={thread.id} className="thread-item">
            <h3>{thread.title}</h3>
            <p>{thread.body}</p>
            <p className="meta-row">
              <span>{discussionAuthorName(thread.user)}</span>
              <span>{thread.comments.length} comments</span>
              <span>{thread.likes.length} likes</span>
            </p>
            <Link href={`/questions/${thread.question.slug}`} className="card-link">
              Open question: {thread.question.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
