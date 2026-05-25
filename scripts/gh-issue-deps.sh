#!/bin/bash

# Show and manage dependencies between GitHub issues
# - List blockers for an issue
# - List issues blocked by an issue
# - Visualize dependency chains

set -e

show_usage() {
    echo "Usage: $0 <command> [issue_number]"
    echo ""
    echo "Commands:"
    echo "  blockers <N>     Show what blocks issue #N"
    echo "  blocking <N>     Show what issue #N blocks"
    echo "  chain <N>        Show full dependency chain for #N"
    echo "  all              Show all blocked/blocking relationships"
    echo "  ready            Show issues ready to start (no blockers)"
    echo "  fix              Auto-fix labels based on blocker states"
    echo ""
    echo "Examples:"
    echo "  $0 blockers 85   # What blocks #85?"
    echo "  $0 blocking 79   # What does #79 block?"
    echo "  $0 chain 94      # Full dependency tree for #94"
    echo "  $0 all           # All dependencies"
    echo "  $0 ready         # What can I work on now?"
    echo "  $0 fix           # Fix S-Blocked labels based on reality"
    exit 1
}

if [ $# -eq 0 ]; then
    show_usage
fi

COMMAND=$1
ISSUE_NUM=$2

case $COMMAND in
"blockers")
    if [ -z "$ISSUE_NUM" ]; then
        echo "❌ Issue number required"
        exit 1
    fi
    
    echo "🔍 Finding blockers for issue #$ISSUE_NUM..."
    echo ""
    
    body=$(gh issue view "$ISSUE_NUM" --json body,title --jq '.body' 2>/dev/null)
    title=$(gh issue view "$ISSUE_NUM" --json title --jq '.title' 2>/dev/null)
    
    echo "Issue #$ISSUE_NUM: $title"
    echo ""
    
    # Extract blocker references
    blockers=$(echo "$body" | grep -iE "Blocked by:" | grep -oE '#[0-9]+' | tr -d '#' | sort -n | uniq)
    
    if [ -z "$blockers" ]; then
        echo "✅ No blockers found"
    else
        echo "Blockers:"
        all_closed=true
        for blocker in $blockers; do
            blocker_data=$(gh issue view "$blocker" --json title,state 2>/dev/null)
            blocker_title=$(echo "$blocker_data" | jq -r '.title')
            blocker_state=$(echo "$blocker_data" | jq -r '.state')
            
            if [ "$blocker_state" = "OPEN" ]; then
                echo "  🔴 #$blocker (OPEN): $blocker_title"
                all_closed=false
            else
                echo "  ✅ #$blocker (CLOSED): $blocker_title"
            fi
        done
        
        echo ""
        if [ "$all_closed" = true ]; then
            echo "💡 All blockers are closed! This issue can be unblocked."
            echo "   Run: ./scripts/gh-update-labels.sh $ISSUE_NUM ready"
        else
            echo "⏳ Waiting on open blockers before this can start."
        fi
    fi
    ;;

"blocking")
    if [ -z "$ISSUE_NUM" ]; then
        echo "❌ Issue number required"
        exit 1
    fi
    
    echo "🔍 Finding issues blocked by #$ISSUE_NUM..."
    echo ""
    
    title=$(gh issue view "$ISSUE_NUM" --json title --jq '.title' 2>/dev/null)
    echo "Issue #$ISSUE_NUM: $title"
    echo ""
    
    # Find issues that reference this one as a blocker
    blocked=$(gh issue list --state open --limit 200 --json number,title,body --jq "
        .[] | 
        select(.body | test(\"Blocked by.*#$ISSUE_NUM\"; \"i\")) |
        \"#\(.number): \(.title)\"
    " 2>/dev/null)
    
    if [ -z "$blocked" ]; then
        echo "✅ No issues are blocked by #$ISSUE_NUM"
    else
        echo "Issues blocked by #$ISSUE_NUM:"
        echo "$blocked" | while read line; do
            echo "  🔒 $line"
        done
        
        count=$(echo "$blocked" | wc -l | tr -d ' ')
        echo ""
        echo "📊 $count issue(s) will be unblocked when #$ISSUE_NUM is completed"
    fi
    ;;

"chain")
    if [ -z "$ISSUE_NUM" ]; then
        echo "❌ Issue number required"
        exit 1
    fi
    
    echo "🔗 Dependency chain for issue #$ISSUE_NUM"
    echo ""
    
    # Recursive function to show chain (depth limited)
    show_chain() {
        local num=$1
        local depth=$2
        local prefix=$3
        
        if [ "$depth" -gt 5 ]; then
            echo "${prefix}  ... (max depth reached)"
            return
        fi
        
        local data=$(gh issue view "$num" --json title,state,body 2>/dev/null)
        local title=$(echo "$data" | jq -r '.title')
        local state=$(echo "$data" | jq -r '.state')
        local body=$(echo "$data" | jq -r '.body')
        
        local status_icon="🔴"
        if [ "$state" = "CLOSED" ]; then
            status_icon="✅"
        fi
        
        echo "${prefix}$status_icon #$num: $title [$state]"
        
        # Find blockers
        local blockers=$(echo "$body" | grep -iE "Blocked by:" | grep -oE '#[0-9]+' | tr -d '#' | sort -n | uniq)
        
        for blocker in $blockers; do
            show_chain "$blocker" $((depth + 1)) "${prefix}  └─ "
        done
    }
    
    show_chain "$ISSUE_NUM" 0 ""
    ;;

"all")
    echo "📊 All dependency relationships"
    echo ""
    
    # Get all open issues with S-Blocked
    echo "🔒 Blocked issues:"
    gh issue list --state open --label "S-Blocked" --json number,title --jq '.[] | "  #\(.number): \(.title)"' 2>/dev/null || echo "  (none)"
    
    echo ""
    echo "⏳ Issues that block others:"
    
    # Find all issues referenced as blockers
    gh issue list --state open --limit 200 --json number,body --jq '
        .[] | 
        .body | 
        capture("Blocked by[^#]*#(?<num>[0-9]+)"; "gi") | 
        .num
    ' 2>/dev/null | sort -n | uniq -c | sort -rn | while read count num; do
        title=$(gh issue view "$num" --json title,state --jq '"\(.title) [\(.state)]"' 2>/dev/null)
        echo "  #$num ($count dependents): $title"
    done
    ;;

"ready")
    echo "✅ Issues ready to start (S-Ready, no open blockers)"
    echo ""
    
    gh issue list --state open --label "S-Ready" --json number,title,labels --jq '
        .[] | 
        {
            number: .number,
            title: .title,
            priority: (.labels | map(select(.name | startswith("P"))) | .[0].name // "P3-Medium")
        } |
        "\(.priority) #\(.number): \(.title)"
    ' 2>/dev/null | sort | while read line; do
        echo "  $line"
    done
    
    echo ""
    echo "Start with: ./scripts/gh-issue-start.sh <number>"
    ;;

"fix")
    echo "🔧 Checking and fixing S-Blocked labels..."
    echo ""
    
    # Get all S-Blocked issues
    blocked_issues=$(gh issue list --state open --label "S-Blocked" --json number --jq '.[].number' 2>/dev/null)
    
    fixed=0
    kept=0
    
    for num in $blocked_issues; do
        body=$(gh issue view "$num" --json body --jq '.body' 2>/dev/null)
        title=$(gh issue view "$num" --json title --jq '.title' 2>/dev/null)
        
        # Extract blockers
        blockers=$(echo "$body" | grep -iE "Blocked by:" | grep -oE '#[0-9]+' | tr -d '#' | sort -n | uniq)
        
        has_open_blocker=false
        for blocker in $blockers; do
            state=$(gh issue view "$blocker" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")
            if [ "$state" = "OPEN" ]; then
                has_open_blocker=true
                break
            fi
        done
        
        if [ "$has_open_blocker" = false ]; then
            echo "🔓 #$num: $title"
            echo "   All blockers closed, unblocking..."
            gh issue edit "$num" --remove-label "S-Blocked" 2>/dev/null || true
            gh issue edit "$num" --add-label "S-Ready" 2>/dev/null || true
            gh issue comment "$num" --body "🔓 **Auto-unblocked**

All blockers are now closed. This issue is ready to work on."
            ((fixed++))
        else
            echo "🔒 #$num: $title (still blocked)"
            ((kept++))
        fi
    done
    
    echo ""
    echo "📊 Results: $fixed unblocked, $kept still blocked"
    ;;

*)
    echo "❌ Unknown command: $COMMAND"
    show_usage
    ;;
esac
