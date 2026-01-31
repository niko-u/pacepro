# PacePro Cost Analysis — January 31, 2026

## Per-User Monthly Cost Breakdown

### OpenAI — The Big Number

| Call Type | Model | Input Tokens | Output Tokens | Cost/Call | Frequency | Monthly Cost |
|-----------|-------|-------------|--------------|-----------|-----------|-------------|
| **Chat response** | gpt-4o | ~1,500 | ~300 | $0.0068 | 10 msgs/day | **$2.04** |
| Preference extraction | gpt-4o-mini | ~800 | ~200 | $0.0002 | 10/day | $0.06 |
| Workout creation check | gpt-4o-mini | ~800 | ~200 | $0.0002 | 10/day | $0.06 |
| Plan modification check | gpt-4o-mini | ~1,000 | ~300 | $0.0003 | 10/day | $0.09 |
| Memory compression | gpt-4o-mini | ~3,000 | ~500 | $0.0008 | 3x/month | $0.002 |
| **Daily check-in** | gpt-4o | ~1,500 | ~200 | $0.0058 | 30/month | **$0.17** |
| **Recovery alert** | gpt-4o | ~1,500 | ~250 | $0.0063 | 10/month | **$0.06** |
| **Weekly outlook** | gpt-4o | ~2,000 | ~300 | $0.0080 | 4/month | **$0.03** |
| **Workout analysis** (Strava) | gpt-4o | ~2,000 | ~300 | $0.0080 | 20/month | **$0.16** |
| Plan generation | gpt-4o-mini | ~2,000 | ~500 | $0.0006 | 1/month | $0.001 |
| Plan extension | gpt-4o-mini | ~1,500 | ~400 | $0.0005 | 4/month | $0.002 |
| **TOTAL AI per user** | | | | | | **~$2.70/month** |

**At 10 messages/day** (moderate user): **~$2.70/month**
**At 20 messages/day** (heavy user): **~$4.80/month**
**At 5 messages/day** (light user): **~$1.50/month**

### Optimization Opportunities

1. **Switch daily check-in → gpt-4o-mini** (-$0.15/month): Simple message, doesn't need full 4o
2. **Switch recovery alert → gpt-4o-mini** (-$0.05/month): Template-like response
3. **Switch workout analysis → gpt-4o-mini** (-$0.14/month): Structured comparison
4. **Aggressive**: Switch main chat to gpt-4o-mini for simple questions, gpt-4o only for complex coaching → ~50% savings on chat costs

**If all cron/webhook calls use gpt-4o-mini:**
- Heavy user (20 msg/day): ~$4.30/month
- Moderate (10 msg/day): ~$2.30/month  
- Light (5 msg/day): ~$1.20/month

### Infrastructure Costs (Fixed)

| Service | Tier | Monthly Cost | Notes |
|---------|------|-------------|-------|
| **Vercel** | Hobby (free) | $0 | ⚠️ 5 crons = problem (Hobby limits to 1/day each) |
| **Vercel** | Pro | $20 | Needed for 5 cron jobs + 60s function timeout |
| **Supabase** | Free | $0 | Up to 500MB DB, 50K auth users |
| **Supabase** | Pro | $25 | 8GB DB, 100K users, real-time connections |
| **Domain** | pacepro.coach | ~$30/year | ~$2.50/month |
| **TOTAL fixed** | | **$22-47/month** | |

### Cost Per User at Scale

| Users | AI Cost | Supabase | Vercel | Total Monthly | Revenue ($50/user) | Margin |
|-------|---------|----------|--------|---------------|--------------------|----|
| 10 | $27 | $0 | $20 | **$47** | $500 | 91% |
| 100 | $270 | $25 | $20 | **$315** | $5,000 | 94% |
| 1,000 | $2,700 | $25 | $20 | **$2,745** | $50,000 | 95% |
| 10,000 | $27,000 | $75 | $20 | **$27,095** | $500,000 | 95% |

### ⚠️ Immediate Action Needed: Vercel Cron Limits

**Vercel Hobby plan only allows cron jobs to run once per day each.** We have 5 cron jobs, some needing more frequent execution:
- `whoop-sync`: every 4 hours → **will only run once/day on Hobby**
- `daily-checkin`: once/day → fine
- `recovery-check`: once/day → fine
- `weekly-outlook`: once/week → fine
- `plan-extend`: once/week → fine

**Options:**
1. **Vercel Pro ($20/month)** — Unlocks all cron schedules + 60s timeout
2. **External cron** — Use a free cron service (cron-job.org) to hit the endpoints with the CRON_SECRET
3. **Combine crons** — Merge recovery-check + whoop-sync into a single endpoint that runs multiple checks

### Token Usage Tracking

The `ai_usage` table tracks every AI call with input/output tokens and estimated cost. Query monthly costs per user:

```sql
SELECT user_id, 
       SUM(input_tokens) as total_input,
       SUM(output_tokens) as total_output,
       SUM(cost_cents) / 100.0 as total_cost_usd
FROM ai_usage 
WHERE created_at >= date_trunc('month', now())
GROUP BY user_id
ORDER BY total_cost_usd DESC;
```

### Break-Even Analysis

At $50/month subscription:
- **Break-even**: ~$2.70 AI cost = **$47.30 margin per user (94.6%)**
- **Need 1 paying user** to cover Vercel Pro
- **Need 2 paying users** to cover Vercel Pro + Supabase Pro
- **Profitable from user #3**
