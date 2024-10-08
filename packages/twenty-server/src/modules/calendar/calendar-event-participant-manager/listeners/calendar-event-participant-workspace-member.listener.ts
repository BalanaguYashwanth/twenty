import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { ObjectRecordCreateEvent } from 'src/engine/integrations/event-emitter/types/object-record-create.event';
import { ObjectRecordUpdateEvent } from 'src/engine/integrations/event-emitter/types/object-record-update.event';
import { objectRecordChangedProperties as objectRecordUpdateEventChangedProperties } from 'src/engine/integrations/event-emitter/utils/object-record-changed-properties.util';
import { InjectMessageQueue } from 'src/engine/integrations/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/integrations/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/integrations/message-queue/services/message-queue.service';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/workspace-event.type';
import {
  CalendarEventParticipantMatchParticipantJob,
  CalendarEventParticipantMatchParticipantJobData,
} from 'src/modules/calendar/calendar-event-participant-manager/jobs/calendar-event-participant-match-participant.job';
import {
  CalendarEventParticipantUnmatchParticipantJob,
  CalendarEventParticipantUnmatchParticipantJobData,
} from 'src/modules/calendar/calendar-event-participant-manager/jobs/calendar-event-participant-unmatch-participant.job';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

@Injectable()
export class CalendarEventParticipantWorkspaceMemberListener {
  constructor(
    @InjectMessageQueue(MessageQueue.calendarQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  @OnEvent('workspaceMember.created')
  async handleCreatedEvent(
    payload: WorkspaceEventBatch<
      ObjectRecordCreateEvent<WorkspaceMemberWorkspaceEntity>
    >,
  ) {
    for (const eventPayload of payload.events) {
      if (eventPayload.properties.after.userEmail === null) {
        continue;
      }

      await this.messageQueueService.add<CalendarEventParticipantMatchParticipantJobData>(
        CalendarEventParticipantMatchParticipantJob.name,
        {
          workspaceId: payload.workspaceId,
          email: eventPayload.properties.after.userEmail,
          workspaceMemberId: eventPayload.recordId,
        },
      );
    }
  }

  @OnEvent('workspaceMember.updated')
  async handleUpdatedEvent(
    payload: WorkspaceEventBatch<
      ObjectRecordUpdateEvent<WorkspaceMemberWorkspaceEntity>
    >,
  ) {
    for (const eventPayload of payload.events) {
      if (
        objectRecordUpdateEventChangedProperties<WorkspaceMemberWorkspaceEntity>(
          eventPayload.properties.before,
          eventPayload.properties.after,
        ).includes('userEmail')
      ) {
        await this.messageQueueService.add<CalendarEventParticipantUnmatchParticipantJobData>(
          CalendarEventParticipantUnmatchParticipantJob.name,
          {
            workspaceId: payload.workspaceId,
            email: eventPayload.properties.before.userEmail,
            personId: eventPayload.recordId,
          },
        );

        await this.messageQueueService.add<CalendarEventParticipantMatchParticipantJobData>(
          CalendarEventParticipantMatchParticipantJob.name,
          {
            workspaceId: payload.workspaceId,
            email: eventPayload.properties.after.userEmail,
            workspaceMemberId: eventPayload.recordId,
          },
        );
      }
    }
  }
}
