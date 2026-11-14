# Simulated InDesign MCP tool results (fictional fixture)

This is a dry run. Treat these as the results the `indesign_local` MCP tools would return if called with matching arguments. Any call not listed here would return an error "not available in simulation".

## get_connection_status()
```json
{"connected": true, "host": {"application": "InDesign", "version": "21.2.0.30"}, "transport": "private plugin mailbox", "job": null}
```

## list_documents()
```json
{"request_id": "a1", "status": "complete", "data": {"documents": [
  {"id": 3, "name": "Thesis_Final.indd", "pages": 64, "modified": false},
  {"id": 5, "name": "Thesis_Final copy.indd", "pages": 64, "modified": true}
]}}
```

## inspect_document(document_id=3, expected_name="Thesis_Final.indd") — excerpt
```json
{"request_id": "a2", "status": "complete", "data": {"id": 3, "name": "Thesis_Final.indd", "pages": 64, "modified": false, "facingPages": true,
 "pageOrder": [{"physical": 36, "label": "22", "side": "LEFT_HAND"}, {"physical": 37, "label": "23", "side": "RIGHT_HAND"}, {"physical": 38, "label": "24", "side": "LEFT_HAND"}],
 "sections": [{"physical": 1, "start": 1, "style": "LOWER_ROMAN"}, {"physical": 15, "start": 1, "style": "ARABIC"}],
 "oversetStoryIds": []}}
```

## list_text_frames(document_id=3, expected_name="Thesis_Final.indd", physical_page=37)
```json
{"request_id": "a3", "status": "complete", "data": {"document_id": 3, "name": "Thesis_Final.indd", "physical_page": 37, "frames": [
  {"frame_id": 902, "story_id": 88, "story_length": 140210, "start": 51230, "length": 2874, "preview": "measured at each station. The second series repeated the protocol with a short"}
]}}
```

## Text of the second paragraph on physical page 37 (as composed)

The paragraph occupies story 88 characters 51618–52003 (zero-based, end exclusive). Its composed lines are:

```
The second series repeated the protocol with a shorter interval between
samples, which reduced drift but introduced a small seasonal bias in the
coastal stations. Correcting for that bias produced the adjusted series
shown in Table 4, and the comparison below summarises the principal
results.
```

The final line is the single word `results.` (a runt). The previous line `shown in Table 4, and the comparison below summarises the principal` begins at story index 51862 and is 68 characters long; the line before it begins at 51791 and is 71 characters long. Current tracking for the whole paragraph is 0.

## prepare_tracking_edit(...)
Returns a plan with `plan_id` "plan-77" echoing the arguments, `before_tracking` (all 0) and `after_tracking`, if `expected_text` exactly equals the story text at [start, start+length). Otherwise: error "Expected text mismatch".

## apply_prepared_edit(plan_id="plan-77")
```json
{"transaction_id": "tx-91", "state": "applied", "story_id": 88, "start": "<as prepared>", "length": "<as prepared>", "before_tracking": "<zeros>", "after_tracking": "<as prepared>"}
```
After this, re-inspection would show the paragraph recomposed into four lines, the last line reading `summarises the principal results.`; neighbouring paragraphs and page 38 are unchanged.
