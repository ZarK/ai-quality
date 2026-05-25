#!/bin/bash

# Complete a GitHub issue
# - Closes the issue
# - Finds and unblocks dependent issues
# - Adds a completion comment

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <issue_number> [--dry-run]"
    echo ""
    echo "Completes an issue by:"
    echo "  1. Closing the issue"
    echo "  2. Finding issues blocked by this one"
    echo "  3. Unblocking those issues (S-Blocked → S-Ready)"
    echo "  4. Adding completion comments"
    echo ""
    echo "Options:"
    echo "  --dry-run    Show what would happen without making changes"
    echo ""
    echo "Example:"
    echo "  $0 85"
    echo "  $0 85 --dry-run"
    exit 1
fi

ISSUE_NUM=$1
DRY_RUN=false

if [ "$2" = "--dry-run" ]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - no changes will be made"
    echo ""
fi

# Check if issue exists and get current state
echo "🔍 Checking issue #$ISSUE_NUM..."

issue_data=$(gh issue view "$ISSUE_NUM" --json number,title,state,labels 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ Issue #$ISSUE_NUM not found"
    exit 1
fi

issue_state=$(echo "$issue_data" | jq -r '.state')
issue_title=$(echo "$issue_data" | jq -r '.title')

# Check if already closed
if [ "$issue_state" = "CLOSED" ]; then
    echo "ℹ️  Issue #$ISSUE_NUM is already closed"
    echo "   Checking for blocked issues to unblock..."
fi

# Find issues that are blocked by this one
# Search for "Blocked by: #N" or "Blocked by: (none)" patterns in issue bodies
echo "🔍 Finding issues blocked by #$ISSUE_NUM..."

blocked_issues=$(gh issue list --state open --limit 200 --json number,body,labels --jq "
    .[] | 
    select(.body | test(\"Blocked by:.*#$ISSUE_NUM\"; \"i\")) |
    select(.labels | map(.name) | index(\"S-Blocked\")) |
    .number
" 2>/dev/null | sort -n | uniq)

# Also check for "Blocked by: #N" in Dependencies section
blocked_issues2=$(gh issue list --state open --limit 200 --json number,body,labels --jq "
    .[] | 
    select(.body | test(\"- Blocked by:.*#$ISSUE_NUM\"; \"i\")) |
    select(.labels | map(.name) | index(\"S-Blocked\")) |
    .number
" 2>/dev/null | sort -n | uniq)

# Combine and dedupe
all_blocked=$(echo -e "$blocked_issues\n$blocked_issues2" | sort -n | uniq | grep -v '^$' || true)

blocked_count=$(echo "$all_blocked" | grep -c '[0-9]' || echo 0)

echo ""
if [ "$blocked_count" -gt 0 ]; then
    echo "📋 Found $blocked_count issue(s) blocked by #$ISSUE_NUM:"
    for blocked_num in $all_blocked; do
        blocked_title=$(gh issue view "$blocked_num" --json title --jq '.title' 2>/dev/null)
        echo "   - #$blocked_num: $blocked_title"
    done
    echo ""
else
    echo "📋 No issues are blocked by #$ISSUE_NUM"
    echo ""
fi

if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY RUN - Would perform:"
    if [ "$issue_state" != "CLOSED" ]; then
        echo "   1. Close issue #$ISSUE_NUM"
    fi
    if [ "$blocked_count" -gt 0 ]; then
        echo "   2. Unblock $blocked_count issue(s): $all_blocked"
    fi
    exit 0
fi

# Close the issue if not already closed
if [ "$issue_state" != "CLOSED" ]; then
    echo "📝 Closing issue #$ISSUE_NUM..."
    gh issue close "$ISSUE_NUM"
    
    # Add completion comment
    gh issue comment "$ISSUE_NUM" --body "✅ **Completed**

This issue has been closed. Any issues that were blocked by this one have been automatically unblocked."
fi

# Always remove S-InProgress label from the completed issue
echo "📝 Removing S-InProgress label from #$ISSUE_NUM..."
gh issue edit "$ISSUE_NUM" --remove-label "S-InProgress" 2>/dev/null || true

# Unblock dependent issues
if [ "$blocked_count" -gt 0 ]; then
    echo ""
    echo "🔓 Unblocking dependent issues..."
    
    for blocked_num in $all_blocked; do
        echo "   Unblocking #$blocked_num..."
        
        # Check if this issue has other blockers still open
        blocked_body=$(gh issue view "$blocked_num" --json body --jq '.body' 2>/dev/null)
        
        # Extract all blocker issue numbers from the body
        other_blockers=$(echo "$blocked_body" | grep -oE '#[0-9]+' | grep -v "#$ISSUE_NUM" | tr -d '#' | sort -n | uniq)
        
        still_blocked=false
        for other in $other_blockers; do
            # Check if this other blocker is in a "Blocked by" context and still open
            if echo "$blocked_body" | grep -iE "Blocked by.*#$other" > /dev/null 2>&1; then
                other_state=$(gh issue view "$other" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")
                if [ "$other_state" = "OPEN" ]; then
                    still_blocked=true
                    echo "      ⚠️  Still blocked by #$other (open)"
                fi
            fi
        done
        
        if [ "$still_blocked" = false ]; then
            # Remove S-Blocked and add S-Ready
            gh issue edit "$blocked_num" --remove-label "S-Blocked" 2>/dev/null || true
            gh issue edit "$blocked_num" --add-label "S-Ready" 2>/dev/null || true
            
            # Add unblock comment
            gh issue comment "$blocked_num" --body "🔓 **Unblocked**

Blocker #$ISSUE_NUM has been completed. This issue is now ready to work on."
            
            echo "      ✅ Unblocked #$blocked_num"
        else
            echo "      ℹ️  #$blocked_num has other open blockers, keeping S-Blocked"
        fi
    done
fi

echo ""
echo "✅ Completed issue #$ISSUE_NUM: $issue_title"
if [ "$blocked_count" -gt 0 ]; then
    echo "🔓 Processed $blocked_count dependent issue(s)"
fi
echo ""
echo "Next steps:"
echo "  ./scripts/gh-priority-order.sh    # See next issue to work on"
echo "  ./scripts/gh-issue-start.sh <N>   # Start the next issue"
